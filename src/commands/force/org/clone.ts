/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { Flags, SfCommand, requiredOrgFlagWithDeprecations, parseVarArgs } from '@salesforce/sf-plugins-core';
import {
  SfError,
  Config,
  Lifecycle,
  Messages,
  OrgTypes,
  OrgConfigProperties,
  StateAggregator,
  SandboxEvents,
  SandboxRequest,
  StatusEvent,
  ResultEvent,
  SandboxProcessObject,
  Logger,
} from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import { lowerToUpper } from '../../../shared/utils';
import { SandboxReporter } from '../../../shared/sandboxReporter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'clone');

export class OrgCloneCommand extends SfCommand<unknown> {
  public static readonly examples = messages.getMessages('examples');
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly requiresProject = false;

  public static readonly SANDBOXDEF_SRC_SANDBOXNAME = 'SourceSandboxName';

  public static readonly flags = {
    'target-org': requiredOrgFlagWithDeprecations,
    type: Flags.enum({
      char: 't',
      summary: messages.getMessage('flags.type'),
      required: true,
      options: ['sandbox'],
    }),
    definitionfile: Flags.file({
      char: 'f',
      exists: true,
      summary: messages.getMessage('flags.definitionfile'),
    }),
    setdefaultusername: Flags.boolean({
      char: 's',
      summary: messages.getMessage('flags.setdefaultusername'),
    }),
    setalias: Flags.string({
      char: 'a',
      summary: messages.getMessage('flags.setalias'),
    }),
    wait: Flags.duration({
      unit: 'minutes',
      char: 'w',
      summary: messages.getMessage('flags.wait'),
      description: messages.getMessage('flagsLong.wait'),
      min: 2,
      defaultValue: 6,
    }),
  };

  public async run(): Promise<unknown> {
    const { flags, args, argv } = await this.parse(OrgCloneCommand);
    const logger = await Logger.child(this.id);
    const varargs = parseVarArgs(args, argv);

    const lifecycle = Lifecycle.getInstance();
    if (flags.type === OrgTypes.Sandbox) {
      // eslint-disable-next-line @typescript-eslint/require-await
      lifecycle.on(SandboxEvents.EVENT_ASYNC_RESULT, async (results: SandboxProcessObject) => {
        // Keep all console output in the command
        this.log(messages.getMessage('commandSuccess', [results.Id, results.SandboxName]));
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) => {
        this.log(SandboxReporter.sandboxProgress(results));
      });

      lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
        const { sandboxReadyForUse, data } = SandboxReporter.logSandboxProcessResult(results);
        this.log(sandboxReadyForUse);
        this.styledHeader('Sandbox Org Cloning Status');
        this.table(data, {
          key: { header: 'Name' },
          value: { header: 'Value' },
        });

        if (results?.sandboxRes?.authUserName) {
          if (flags.setalias) {
            const stateAggregator = await StateAggregator.getInstance();
            stateAggregator.aliases.set(flags.setalias, results.sandboxRes.authUserName);
            const result = stateAggregator.aliases.getAll();
            logger.debug('Set Alias: %s result: %s', flags.setalias, result);
          }
          if (flags.setdefaultusername) {
            const globalConfig: Config = this.configAggregator.getGlobalConfig();
            globalConfig.set(OrgConfigProperties.TARGET_ORG, results.sandboxRes.authUserName);
            const result = await globalConfig.write();
            logger.debug('Set defaultUsername: %s result: %s', flags.setdefaultusername, result);
          }
        }
      });

      const { sandboxReq, srcSandboxName } = createSandboxRequest(flags, logger, varargs);

      logger.debug('Calling clone with SandboxRequest: %s and SandboxName: %s ', sandboxReq, srcSandboxName);
      const wait = flags.wait;
      return flags['target-org'].cloneSandbox(sandboxReq, srcSandboxName, { wait });
    } else {
      throw new SfError(
        messages.getMessage('commandOrganizationTypeNotSupport', [OrgTypes.Sandbox]),
        messages.getMessage('commandOrganizationTypeNotSupportAction', [OrgTypes.Sandbox])
      );
    }
  }
}

const createSandboxRequest = (
  flags: Interfaces.InferredFlags<typeof OrgCloneCommand.flags>,
  logger: Logger,
  varargs?: Record<string, string>
): { sandboxReq: SandboxRequest; srcSandboxName: string } => {
  logger.debug('Clone started with args %s ', flags);
  logger.debug('Clone Varargs: %s ', varargs);

  const sandboxDefFileContents = flags.definitionfile
    ? lowerToUpper(JSON.parse(fs.readFileSync(flags.definitionfile, 'utf-8')) as Record<string, unknown>)
    : {};
  const capitalizedVarArgs = varargs ? lowerToUpper(varargs) : {};

  // varargs override file input
  const sandboxReq: SandboxRequest = { SandboxName: undefined, ...sandboxDefFileContents, ...capitalizedVarArgs };

  logger.debug('SandboxRequest after merging DefFile and Varargs: %s ', sandboxReq);

  // try to find the source sandbox name either from the definition file or the commandline arg
  // NOTE the name and the case "SourceSandboxName" must match exactly
  const srcSandboxName = sandboxReq[OrgCloneCommand.SANDBOXDEF_SRC_SANDBOXNAME] as string;
  if (srcSandboxName) {
    // we have to delete this property from the sandboxRequest object,
    // because sandboxRequest object represent the POST request to create SandboxInfo bpo,
    // sandboxInfo does not have a column named  SourceSandboxName, this field will be converted to sourceId in the clone call below
    delete sandboxReq[OrgCloneCommand.SANDBOXDEF_SRC_SANDBOXNAME];
  } else {
    // error - we need SourceSandboxName to know which sandbox to clone from
    throw new SfError(
      messages.getMessage('missingSourceSandboxName', [OrgCloneCommand.SANDBOXDEF_SRC_SANDBOXNAME]),
      messages.getMessage('missingSourceSandboxNameAction', [OrgCloneCommand.SANDBOXDEF_SRC_SANDBOXNAME])
    );
  }
  return { sandboxReq, srcSandboxName };
};
