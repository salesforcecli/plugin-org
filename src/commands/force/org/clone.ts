/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import * as fs from 'fs';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
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
} from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { lowerToUpper } from '../../../shared/utils';
import { SandboxReporter } from '../../../shared/sandboxReporter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'clone');

export class OrgCloneCommand extends SfdxCommand {
  public static readonly examples = messages.getMessage('examples').split(EOL);
  public static readonly description = messages.getMessage('description');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly varargs = true;
  public static readonly SANDBOXDEF_SRC_SANDBOXNAME = 'SourceSandboxName';

  public static readonly flagsConfig: FlagsConfig = {
    type: flags.enum({
      char: 't',
      description: messages.getMessage('flags.type'),
      required: true,
      options: ['sandbox'],
    }),
    definitionfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('flags.definitionfile'),
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: messages.getMessage('flags.setdefaultusername'),
    }),
    setalias: flags.string({
      char: 'a',
      description: messages.getMessage('flags.setalias'),
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('flags.wait'),
      longDescription: messages.getMessage('flagsLong.wait'),
      min: Duration.minutes(2),
      default: Duration.minutes(6),
    }),
  };

  public async run(): Promise<unknown> {
    const lifecycle = Lifecycle.getInstance();
    if (this.flags.type === OrgTypes.Sandbox) {
      // eslint-disable-next-line @typescript-eslint/require-await
      lifecycle.on(SandboxEvents.EVENT_ASYNC_RESULT, async (results: SandboxProcessObject) => {
        // Keep all console output in the command
        this.ux.log(messages.getMessage('commandSuccess', [results.Id, results.SandboxName]));
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) => {
        this.ux.log(SandboxReporter.sandboxProgress(results));
      });

      lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
        const { sandboxReadyForUse, data } = SandboxReporter.logSandboxProcessResult(results);
        this.ux.log(sandboxReadyForUse);
        this.ux.styledHeader('Sandbox Org Cloning Status');
        this.ux.table(data, {
          key: { header: 'Name' },
          value: { header: 'Value' },
        });

        if (results?.sandboxRes?.authUserName) {
          if (this.flags.setalias) {
            const stateAggregator = await StateAggregator.getInstance();
            stateAggregator.aliases.set(this.flags.setalias as string, results.sandboxRes.authUserName);
            const result = stateAggregator.aliases.getAll();
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

      const { sandboxReq, srcSandboxName } = this.createSandboxRequest();

      this.logger.debug('Calling clone with SandboxRequest: %s and SandboxName: %s ', sandboxReq, srcSandboxName);
      const wait = this.flags.wait as Duration;
      return this.org.cloneSandbox(sandboxReq, srcSandboxName, { wait });
    } else {
      throw new SfError(
        messages.getMessage('commandOrganizationTypeNotSupport', [OrgTypes.Sandbox]),
        messages.getMessage('commandOrganizationTypeNotSupportAction', [OrgTypes.Sandbox])
      );
    }
  }

  private createSandboxRequest(): { sandboxReq: SandboxRequest; srcSandboxName: string } {
    this.logger.debug('Clone started with args %s ', this.flags);
    this.logger.debug('Clone Varargs: %s ', this.varargs);
    let sandboxDefFileContents = this.readJsonDefFile();
    let capitalizedVarArgs = {};

    if (sandboxDefFileContents) {
      sandboxDefFileContents = lowerToUpper(sandboxDefFileContents);
    }
    if (this.varargs) {
      capitalizedVarArgs = lowerToUpper(this.varargs);
    }

    // varargs override file input
    const sandboxReq: SandboxRequest = { SandboxName: undefined, ...sandboxDefFileContents, ...capitalizedVarArgs };

    this.logger.debug('SandboxRequest after merging DefFile and Varargs: %s ', sandboxReq);

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
  }

  private readJsonDefFile(): Record<string, unknown> {
    // the -f option
    if (this.flags.definitionfile) {
      this.logger.debug('Reading JSON DefFile %s ', this.flags.definitionfile);
      return JSON.parse(fs.readFileSync(this.flags.definitionfile as string, 'utf-8')) as Record<string, unknown>;
    }
  }
}
