/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Interfaces from '@oclif/core/interfaces';
import {
  Flags,
  loglevel,
  optionalHubFlagWithDeprecations,
  optionalOrgFlagWithDeprecations,
  orgApiVersionFlagWithDeprecations,
  parseVarArgs,
  SfCommand,
} from '@salesforce/sf-plugins-core';
import {
  AuthFields,
  Config,
  Lifecycle,
  Logger,
  Messages,
  OrgConfigProperties,
  OrgTypes,
  ResultEvent,
  SandboxEvents,
  SandboxProcessObject,
  SandboxUserAuthResponse,
  ScratchOrgInfo,
  ScratchOrgRequest,
  SfError,
  StateAggregator,
  StatusEvent,
} from '@salesforce/core';
import requestFunctions from '../../../shared/sandboxRequest.js';
import { SandboxReporter } from '../../../shared/sandboxReporter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create');

export type ScratchOrgProcessObject = {
  username?: string;
  scratchOrgInfo: ScratchOrgInfo;
  authFields?: AuthFields;
  warnings: string[];
  orgId: string;
};

export type CreateResult = ScratchOrgProcessObject | SandboxProcessObject;

export class Create extends SfCommand<CreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static state = 'deprecated';
  public static readonly hidden = true;
  public static deprecationOptions = {
    message: messages.getMessage('deprecation'),
  };

  // needed to allow varargs
  public static readonly strict = false;

  public static readonly flags = {
    'target-org': {
      ...optionalOrgFlagWithDeprecations,
      summary: messages.getMessage('flags.targetOrg.summary'),
    },
    'target-dev-hub': optionalHubFlagWithDeprecations,
    'api-version': orgApiVersionFlagWithDeprecations,
    loglevel,
    type: Flags.custom<OrgTypes>({
      options: [OrgTypes.Scratch, OrgTypes.Sandbox],
    })({
      char: 't',
      summary: messages.getMessage('flags.type.summary'),
      default: OrgTypes.Scratch,
    }),
    definitionfile: Flags.file({
      exists: true,
      char: 'f',
      summary: messages.getMessage('flags.definitionfile.summary'),
    }),
    nonamespace: Flags.boolean({
      char: 'n',
      summary: messages.getMessage('flags.nonamespace.summary'),
    }),
    noancestors: Flags.boolean({
      char: 'c',
      summary: messages.getMessage('flags.noancestors.summary'),
    }),
    clientid: Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.clientid.summary'),
    }),
    setdefaultusername: Flags.boolean({
      char: 's',
      summary: messages.getMessage('flags.setdefaultusername.summary'),
    }),
    setalias: Flags.string({
      char: 'a',
      summary: messages.getMessage('flags.setalias.summary'),
    }),
    wait: Flags.duration({
      unit: 'minutes',
      char: 'w',
      summary: messages.getMessage('flags.wait.summary'),
      min: 6,
      defaultValue: 6,
    }),
    durationdays: Flags.integer({
      char: 'd',
      summary: messages.getMessage('flags.durationdays.summary'),
      min: 1,
      max: 30,
      default: 7,
    }),
    retry: Flags.integer({
      hidden: true,
      default: 0,
      max: 10,
      summary: messages.getMessage('flags.retry.summary'),
    }),
  };
  private sandboxAuth?: SandboxUserAuthResponse;
  private logger!: Logger;
  private varArgs: Record<string, string | undefined> = {};
  private flags!: Interfaces.InferredFlags<typeof Create.flags>;

  public async run(): Promise<CreateResult> {
    const { flags, args, argv } = await this.parse(Create);

    this.flags = flags;
    this.varArgs = parseVarArgs(args, argv as string[]);
    this.logger = await Logger.child(this.constructor.name);

    if (flags.type === OrgTypes.Sandbox) {
      this.validateSandboxFlags();
      return this.createSandbox();
    } else {
      // default to scratch org
      return this.createScratchOrg();
    }
  }

  private validateSandboxFlags(): void {
    if (this.flags.retry !== 0) {
      throw new SfError(messages.getMessage('retryIsNotValidForSandboxes'), 'retryIsNotValidForSandboxes');
    }

    if (this.flags.clientid) {
      this.warn(messages.getMessage('clientIdNotSupported', [this.flags.clientid]));
    }
    if (this.flags.nonamespace) {
      this.warn(messages.getMessage('noNamespaceNotSupported', [this.flags.nonamespace]));
    }
    if (this.flags.noancestors) {
      this.warn(messages.getMessage('noAncestorsNotSupported', [this.flags.noancestors]));
    }
    if (this.flags.durationdays) {
      this.warn(messages.getMessage('durationDaysNotSupported', [this.flags.durationdays]));
    }
  }

  private async createSandbox(): Promise<SandboxProcessObject> {
    if (!this.flags['target-org']) {
      throw new SfError(messages.getMessage('requiresUsername', [this.config.bin]));
    }
    const lifecycle = Lifecycle.getInstance();
    const username = this.flags['target-org'].getUsername();
    // register the sandbox event listeners before calling `prodOrg.createSandbox()`

    lifecycle.on(SandboxEvents.EVENT_ASYNC_RESULT, async (results: SandboxProcessObject) =>
      Promise.resolve(
        this.log(messages.getMessage('sandboxSuccess', [results.Id, this.config.bin, results.SandboxName, username]))
      )
    );

    lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) =>
      Promise.resolve(this.log(SandboxReporter.sandboxProgress(results)))
    );

    lifecycle.on(SandboxEvents.EVENT_AUTH, async (results: SandboxUserAuthResponse) => {
      this.sandboxAuth = results;
      return Promise.resolve();
    });

    lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
      const { sandboxReadyForUse, data } = SandboxReporter.logSandboxProcessResult(results);
      this.log(sandboxReadyForUse);
      this.styledHeader('Sandbox Org Creation Status');
      this.table(data, {
        key: { header: 'Name' },
        value: { header: 'Value' },
      });
      if (results.sandboxRes?.authUserName) {
        if (this.flags.setalias) {
          const stateAggregator = await StateAggregator.getInstance();
          await stateAggregator.aliases.setAndSave(this.flags.setalias, results.sandboxRes.authUserName);
          this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, stateAggregator.aliases.getAll());
        }
        if (this.flags.setdefaultusername) {
          const globalConfig: Config = this.configAggregator.getGlobalConfig();
          globalConfig.set(OrgConfigProperties.TARGET_ORG, results.sandboxRes.authUserName);
          const result = await globalConfig.write();
          this.logger.debug('Set defaultUsername: %s result: %s', this.flags.setdefaultusername, result);
        }
      }
    });

    const { sandboxReq } = await requestFunctions.createSandboxRequest(
      false,
      this.flags.definitionfile,
      this.logger,
      this.varArgs
    );

    this.logger.debug('Calling create with SandboxRequest: %s ', sandboxReq);
    const wait = this.flags.wait;

    try {
      return await this.flags['target-org'].createSandbox(sandboxReq, { wait });
    } catch (e) {
      // guaranteed to be SfError from core;
      const err = e as SfError;
      if (err?.message.includes('The org cannot be found')) {
        // there was most likely an issue with DNS when auth'ing to the new sandbox, but it was created.
        if (this.flags.setalias && this.sandboxAuth) {
          const stateAggregator = await StateAggregator.getInstance();
          await stateAggregator.aliases.setAndSave(this.flags.setalias, this.sandboxAuth.authUserName);
          this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, stateAggregator.aliases.getAll());
        }
        if (this.flags.setdefaultusername && this.sandboxAuth) {
          const globalConfig: Config = this.configAggregator.getGlobalConfig();
          globalConfig.set(OrgConfigProperties.TARGET_ORG, this.sandboxAuth.authUserName);
          const result = await globalConfig.write();
          this.logger.debug('Set defaultUsername: %s result: %s', this.flags.setdefaultusername, result);
        }
        err.actions = [
          messages.getMessage('dnsTimeout', [this.config.bin, this.config.bin]),
          messages.getMessage('partialSuccess', [this.config.bin, this.config.bin, this.config.bin]),
        ];
        err.exitCode = 68;
      }

      throw err;
    }
  }

  private async createScratchOrg(): Promise<ScratchOrgProcessObject> {
    this.logger.debug('OK, will do scratch org creation');
    if (!this.flags['target-dev-hub']) {
      throw new SfError(messages.getMessage('RequiresDevhubUsernameError'));
    }
    // Ensure we have an org config input source.
    if (!this.flags.definitionfile && Object.keys(this.varArgs).length === 0) {
      throw new SfError(messages.getMessage('noConfig'));
    }

    this.logger.debug('validation complete');

    const createCommandOptions: ScratchOrgRequest = {
      connectedAppConsumerKey: this.flags.clientid,
      durationDays: this.flags.durationdays,
      nonamespace: this.flags.nonamespace,
      noancestors: this.flags.noancestors,
      wait: this.flags.wait,
      retry: this.flags.retry,
      apiversion: this.flags['api-version'],
      definitionfile: this.flags.definitionfile,
      orgConfig: this.varArgs,
      // If the user supplied a specific client ID, we have no way of knowing if it's
      // a certificate-based Connected App or not. Therefore, we have to assume that
      // we'll need the client secret, so prompt the user for it.
      clientSecret: this.flags.clientid
        ? await this.secretPrompt({ message: messages.getMessage('secretPrompt') })
        : undefined,
      setDefault: this.flags.setdefaultusername === true,
      alias: this.flags.setalias,
      tracksSource: true,
    };

    const { username, scratchOrgInfo, authFields, warnings } = await this.flags['target-dev-hub'].scratchOrgCreate(
      createCommandOptions
    );

    if (!scratchOrgInfo) {
      throw new SfError('No scratch org info returned from scratchOrgCreate');
    }
    if (!authFields?.orgId) {
      throw new SfError('Information missing from authFields');
    }

    await Lifecycle.getInstance().emit('scratchOrgInfo', scratchOrgInfo);

    this.logger.debug(`orgConfig.loginUrl: ${authFields?.loginUrl ?? '<not found>'}`);
    this.logger.debug(`orgConfig.instanceUrl: ${authFields?.instanceUrl ?? '<not found>'}`);

    this.log(messages.getMessage('scratchOrgCreateSuccess', [authFields?.orgId, username]));

    if (warnings.length > 0) {
      warnings.forEach((warning) => {
        this.warn(warning);
      });
    }

    return {
      username,
      scratchOrgInfo,
      authFields,
      warnings,
      orgId: authFields?.orgId,
    };
  }
}
