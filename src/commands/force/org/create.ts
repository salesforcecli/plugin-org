/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as fs from 'fs';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Duration } from '@salesforce/kit';
import {
  AuthFields,
  StateAggregator,
  Config,
  Lifecycle,
  Messages,
  Org,
  OrgTypes,
  OrgConfigProperties,
  ResultEvent,
  SandboxEvents,
  SandboxProcessObject,
  SandboxRequest,
  SandboxUserAuthResponse,
  SfError,
  StatusEvent,
  ScratchOrgInfo,
  ScratchOrgRequest,
} from '@salesforce/core';
import { SandboxReporter } from '../../../shared/sandboxReporter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create');

export interface ScratchOrgProcessObject {
  username?: string;
  scratchOrgInfo: ScratchOrgInfo;
  authFields?: AuthFields;
  warnings: string[];
  orgId: string;
}

export class Create extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly supportsDevhubUsername = true;
  public static readonly supportsUsername = true;
  public static readonly varargs = true;
  public static readonly aliases = ['force:org:beta:create'];
  public static readonly flagsConfig: FlagsConfig = {
    type: flags.enum({
      char: 't',
      description: messages.getMessage('flags.type'),
      options: [OrgTypes.Scratch, OrgTypes.Sandbox],
      default: OrgTypes.Scratch,
    }),
    definitionfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('flags.definitionFile'),
    }),
    nonamespace: flags.boolean({
      char: 'n',
      description: messages.getMessage('flags.noNamespace'),
    }),
    noancestors: flags.boolean({
      char: 'c',
      description: messages.getMessage('flags.noAncestors'),
    }),
    clientid: flags.string({
      char: 'i',
      description: messages.getMessage('flags.clientId'),
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: messages.getMessage('flags.setDefaultUsername'),
    }),
    setalias: flags.string({
      char: 'a',
      description: messages.getMessage('flags.setAlias'),
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('flags.wait'),
      min: 6,
      default: Duration.minutes(6),
    }),
    durationdays: flags.integer({
      char: 'd',
      description: messages.getMessage('flags.durationDays'),
      min: 1,
      max: 30,
      default: 7,
    }),
    retry: flags.number({
      hidden: true,
      default: 0,
      max: 10,
      description: messages.getMessage('flags.retry'),
    }),
  };
  private sandboxAuth?: SandboxUserAuthResponse;

  public async run(): Promise<SandboxProcessObject | ScratchOrgProcessObject> {
    this.logger.debug('Create started with args %s ', this.flags);

    if (this.flags.type === OrgTypes.Sandbox) {
      this.validateSandboxFlags();
      return this.createSandbox();
    } else {
      // default to scratch org
      return this.createScratchOrg();
    }
  }

  private validateSandboxFlags(): void {
    if (!this.flags.targetusername) {
      throw new SfError(messages.getMessage('requiresUsername'));
    }
    if (this.flags.retry !== 0) {
      throw new SfError(messages.getMessage('retryIsNotValidForSandboxes'), 'retryIsNotValidForSandboxes');
    }

    if (this.flags.clientid) {
      this.ux.warn(messages.getMessage('clientIdNotSupported', [this.flags.clientid]));
    }
    if (this.flags.nonamespace) {
      this.ux.warn(messages.getMessage('noNamespaceNotSupported', [this.flags.nonamespace]));
    }
    if (this.flags.noancestors) {
      this.ux.warn(messages.getMessage('noAncestorsNotSupported', [this.flags.noancestors]));
    }
    if (this.flags.durationdays) {
      this.ux.warn(messages.getMessage('durationDaysNotSupported', [this.flags.durationdays]));
    }
  }

  private lowerToUpper(object: Record<string, unknown>): Record<string, unknown> {
    // the API has keys defined in capital camel case, while the definition schema has them as lower camel case
    // we need to convert lower camel case to upper before merging options so they will override properly
    Object.keys(object).map((key) => {
      const upperCase = key.charAt(0).toUpperCase();
      if (key.charAt(0) !== upperCase) {
        const capitalKey = upperCase + key.slice(1);
        object[capitalKey] = object[key];
        delete object[key];
      }
    });
    return object;
  }

  private createSandboxRequest(): SandboxRequest {
    this.logger.debug('Create Varargs: %s ', this.varargs);
    let sandboxDefFileContents = this.readJsonDefFile();
    let capitalizedVarArgs = {};

    if (sandboxDefFileContents) {
      sandboxDefFileContents = this.lowerToUpper(sandboxDefFileContents);
    }
    if (this.varargs) {
      capitalizedVarArgs = this.lowerToUpper(this.varargs);
    }
    // varargs override file input
    const sandboxReq: SandboxRequest = { SandboxName: undefined, ...sandboxDefFileContents, ...capitalizedVarArgs };

    if (!sandboxReq.SandboxName) {
      // sandbox names are 10 chars or less, a radix of 36 = [a-z][0-9]
      // technically without querying the production org, the generated name could already exist, but the chances of that are lower than the perf penalty of querying and verifying
      sandboxReq.SandboxName = `sbx${Date.now().toString(36).slice(-7)}`;
      this.ux.warn(`No SandboxName defined, generating new SandboxName: ${sandboxReq.SandboxName}`);
    }
    if (!sandboxReq.LicenseType) {
      throw new SfError(messages.getMessage('missingLicenseType'));
    }
    return sandboxReq;
  }

  private async createSandbox(): Promise<SandboxProcessObject> {
    const prodOrg = await Org.create({ aliasOrUsername: this.flags.targetusername as string });
    const lifecycle = Lifecycle.getInstance();

    // register the sandbox event listeners before calling `prodOrg.createSandbox()`

    // `on` doesn't support synchronous methods
    // eslint-disable-next-line @typescript-eslint/require-await
    lifecycle.on(SandboxEvents.EVENT_ASYNC_RESULT, async (results: SandboxProcessObject) => {
      this.ux.log(messages.getMessage('sandboxSuccess', [results.Id, results.SandboxName, this.flags.targetusername]));
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) => {
      this.ux.log(SandboxReporter.sandboxProgress(results));
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    lifecycle.on(SandboxEvents.EVENT_AUTH, async (results: SandboxUserAuthResponse) => {
      this.sandboxAuth = results;
    });

    lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
      const { sandboxReadyForUse, data } = SandboxReporter.logSandboxProcessResult(results);
      this.ux.log(sandboxReadyForUse);
      this.ux.styledHeader('Sandbox Org Creation Status');
      this.ux.table(data, {
        key: { header: 'Name' },
        value: { header: 'Value' },
      });
      if (results.sandboxRes?.authUserName) {
        if (this.flags.setalias) {
          const stateAggregator = await StateAggregator.getInstance();
          stateAggregator.aliases.set(this.flags.setalias, results.sandboxRes.authUserName);
          const result = await stateAggregator.aliases.write();
          this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, result);
        }
        if (this.flags.setdefaultusername) {
          const globalConfig: Config = this.configAggregator.getGlobalConfig();
          globalConfig.set(OrgConfigProperties.TARGET_ORG, results.sandboxRes.authUserName);
          const result = await globalConfig.write();
          this.logger.debug('Set defaultUsername: %s result: %s', this.flags.setdefaultusername, result);
        }
      }
    });

    const sandboxReq = this.createSandboxRequest();

    this.logger.debug('Calling create with SandboxRequest: %s ', sandboxReq);
    const wait = this.flags.wait as Duration;

    try {
      return await prodOrg.createSandbox(sandboxReq, { wait });
    } catch (e) {
      // guaranteed to be SfdxError from core;
      const err = e as SfError;
      if (err?.message.includes('The org cannot be found')) {
        // there was most likely an issue with DNS when auth'ing to the new sandbox, but it was created.
        if (this.flags.setalias && this.sandboxAuth) {
          const stateAggregator = await StateAggregator.getInstance();
          stateAggregator.aliases.set(this.flags.setalias, this.sandboxAuth.authUserName);
          const result = await stateAggregator.aliases.write();
          this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, result);
        }
        if (this.flags.setdefaultusername && this.sandboxAuth) {
          const globalConfig: Config = this.configAggregator.getGlobalConfig();
          globalConfig.set(OrgConfigProperties.TARGET_ORG, this.sandboxAuth.authUserName);
          const result = await globalConfig.write();
          this.logger.debug('Set defaultUsername: %s result: %s', this.flags.setdefaultusername, result);
        }
        err.actions = [messages.getMessage('dnsTimeout'), messages.getMessage('partialSuccess')];
        err.exitCode = 68;
        throw err;
      }
    }
  }

  private readJsonDefFile(): Record<string, unknown> {
    // the -f option
    if (this.flags.definitionfile) {
      this.logger.debug('Reading JSON DefFile %s ', this.flags.definitionfile);
      return JSON.parse(fs.readFileSync(this.flags.definitionfile, 'utf-8')) as Record<string, unknown>;
    }
  }

  private async createScratchOrg(): Promise<ScratchOrgProcessObject> {
    this.logger.debug('OK, will do scratch org creation');
    if (!this.hubOrg) {
      throw new SfError(messages.getMessage('RequiresDevhubUsernameError'));
    }
    // Ensure we have an org config input source.
    if (!this.flags.definitionfile && Object.keys(this.varargs).length === 0) {
      throw new SfError(messages.getMessage('noConfig'));
    }

    this.logger.debug('validation complete');

    // If the user supplied a specific client ID, we have no way of knowing if it's
    // a certificate-based Connected App or not. Therefore, we have to assume that
    // we'll need the client secret, so prompt the user for it.
    const secret = this.flags.clientid
      ? await this.ux.prompt(messages.getMessage('secretPrompt'), {
          type: 'mask',
        })
      : undefined;

    const createCommandOptions: ScratchOrgRequest = {
      connectedAppConsumerKey: this.flags.clientid as string,
      durationDays: this.flags.durationdays as number,
      nonamespace: this.flags.nonamespace as boolean,
      noancestors: this.flags.noancestors as boolean,
      wait: this.flags.wait as Duration,
      retry: this.flags.retry as number,
      apiversion: this.flags.apiversion as string,
      definitionfile: this.flags.definitionfile as string,
      orgConfig: this.varargs,
      clientSecret: secret,
      setDefault: (this.flags.setdefaultusername as boolean) === true,
      alias: this.flags.setalias as string | undefined,
      tracksSource: true,
    };

    const { username, scratchOrgInfo, authFields, warnings } = await this.hubOrg.scratchOrgCreate(createCommandOptions);

    await Lifecycle.getInstance().emit('scratchOrgInfo', scratchOrgInfo);

    this.logger.debug(`orgConfig.loginUrl: ${authFields.loginUrl}`);
    this.logger.debug(`orgConfig.instanceUrl: ${authFields.instanceUrl}`);

    this.ux.log(messages.getMessage('scratchOrgCreateSuccess', [authFields.orgId, username]));

    if (warnings.length > 0) {
      warnings.forEach((warning) => {
        this.ux.warn(warning);
      });
    }

    return {
      username,
      scratchOrgInfo,
      authFields,
      warnings,
      orgId: authFields.orgId,
    };
  }
}
