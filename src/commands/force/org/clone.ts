/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
  parseVarArgs,
  orgApiVersionFlagWithDeprecations,
  loglevel,
} from '@salesforce/sf-plugins-core';
import {
  SfError,
  Lifecycle,
  Messages,
  OrgTypes,
  OrgConfigProperties,
  StateAggregator,
  SandboxEvents,
  StatusEvent,
  ResultEvent,
  SandboxProcessObject,
  Logger,
} from '@salesforce/core';
import requestFunctions from '../../../shared/sandboxRequest.js';
import { SandboxReporter } from '../../../shared/sandboxReporter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages('@salesforce/plugin-org', 'clone');

export class OrgCloneCommand extends SfCommand<SandboxProcessObject> {
  public static readonly examples = messages.getMessages('examples');
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly strict = false;
  public static state = 'deprecated';
  public static deprecationOptions = {
    to: 'org:create:sandbox',
    version: '60.0',
  };
  public static readonly SANDBOXDEF_SRC_SANDBOXNAME = 'SourceSandboxName';

  public static readonly flags = {
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': orgApiVersionFlagWithDeprecations,
    type: Flags.custom<'sandbox'>({
      options: ['sandbox'],
    })({
      char: 't',
      summary: messages.getMessage('flags.type.summary'),
      required: true,
    }),
    definitionfile: Flags.file({
      char: 'f',
      exists: true,
      summary: messages.getMessage('flags.definitionfile.summary'),
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
      description: messages.getMessage('flags.wait.description'),
      min: 2,
      defaultValue: 6,
    }),
    loglevel,
  };

  private logger!: Logger;

  public async run(): Promise<SandboxProcessObject> {
    const { flags, args, argv } = await this.parse(OrgCloneCommand);
    this.logger = await Logger.child(this.constructor.name);
    const varargs = parseVarArgs(args, argv as string[]);

    const lifecycle = Lifecycle.getInstance();
    if (flags.type === OrgTypes.Sandbox.toString()) {
      lifecycle.on(SandboxEvents.EVENT_ASYNC_RESULT, async (results: SandboxProcessObject) =>
        // Keep all console output in the command
        Promise.resolve(
          this.log(messages.getMessage('commandSuccess', [results.Id, this.config.bin, results.SandboxName]))
        )
      );

      lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) =>
        Promise.resolve(this.log(SandboxReporter.sandboxProgress(results)))
      );

      lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
        const { sandboxReadyForUse, data } = SandboxReporter.logSandboxProcessResult(results);
        this.log(sandboxReadyForUse);
        this.styledHeader('Sandbox Org Cloning Status');
        this.table(data, {
          key: { header: 'Name' },
          value: { header: 'Value' },
        });

        if (results?.sandboxRes?.authUserName) {
          if (flags.setalias) await this.setAlias(flags.setalias, results.sandboxRes.authUserName);
          if (flags.setdefaultusername) await this.setDefaultUsername(results.sandboxRes.authUserName);
        }
      });

      const { sandboxReq, srcSandboxName } = await requestFunctions.createSandboxRequest(
        true,
        flags.definitionfile,
        this.logger,
        varargs
      );

      this.logger.debug('Calling clone with SandboxRequest: %s and SandboxName: %s ', sandboxReq, srcSandboxName);
      flags['target-org'].getConnection(flags['api-version']);
      return flags['target-org'].cloneSandbox(sandboxReq, srcSandboxName, { wait: flags.wait });
    } else {
      throw new SfError(
        messages.getMessage('commandOrganizationTypeNotSupport', [OrgTypes.Sandbox]),
        messages.getMessage('commandOrganizationTypeNotSupportAction', [OrgTypes.Sandbox])
      );
    }
  }

  public async setAlias(alias: string, username: string): Promise<void> {
    const stateAggregator = await StateAggregator.getInstance();
    stateAggregator.aliases.set(alias, username);
    const result = stateAggregator.aliases.getAll();
    this.logger.debug('Set Alias: %s result: %s', alias, result);
  }

  public async setDefaultUsername(username: string): Promise<void> {
    const globalConfig = this.configAggregator.getGlobalConfig();
    globalConfig.set(OrgConfigProperties.TARGET_ORG, username);
    const result = await globalConfig.write();
    this.logger.debug('Set defaultUsername: %s result: %s', username, result);
  }
}
