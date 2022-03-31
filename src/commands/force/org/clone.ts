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
  SfdxError,
  SfdxErrorConfig,
  Config,
  Lifecycle,
  Messages,
  OrgTypes,
  Aliases,
  SandboxEvents,
  SandboxRequest,
  StatusEvent,
  ResultEvent,
  SandboxProcessObject,
} from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { SandboxReporter } from '../../../shared/sandboxReporter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'clone');

export class OrgCloneCommand extends SfdxCommand {
  public static readonly examples = messages.getMessage('examples').split(EOL);
  public static readonly description = messages.getMessage('description');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly SANDBOXDEF_SRC_SANDBOXNAME = 'SourceSandboxName';

  public static readonly flagsConfig: FlagsConfig = {
    type: flags.enum({
      char: 't',
      description: messages.getMessage('type'),
      longDescription: messages.getMessage('type'),
      required: true,
      options: ['sandbox'],
    }),
    definitionfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('definitionfile'),
      longDescription: messages.getMessage('definitionfile'),
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: messages.getMessage('setdefaultusername'),
      longDescription: messages.getMessage('setdefaultusername'),
    }),
    setalias: flags.string({
      char: 'a',
      description: messages.getMessage('setalias'),
      longDescription: messages.getMessage('setalias'),
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('flags.wait'),
      min: Duration.minutes(2),
      default: Duration.minutes(6),
    }),
  };

  protected readonly lifecycleEventNames = ['postorgcreate'];

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
        SandboxReporter.sandboxProgress(results);
      });

      lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
        SandboxReporter.logSandboxProcessResult(results);
        if (results.sandboxRes && results.sandboxRes.authUserName) {
          if (this.flags.setalias) {
            const alias = await Aliases.create({});
            const result = alias.set(this.flags.setalias, results.sandboxRes.authUserName);
            this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, result);
          }
          if (this.flags.setdefaultusername) {
            const globalConfig: Config = this.configAggregator.getGlobalConfig();
            globalConfig.set(Config.DEFAULT_USERNAME, results.sandboxRes.authUserName);
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
      throw SfdxError.create(
        new SfdxErrorConfig('@salesforce/plugin-org', 'clone', 'commandOrganizationTypeNotSupport', [
          OrgTypes.Sandbox,
        ]).addAction('commandOrganizationTypeNotSupportAction', [OrgTypes.Sandbox])
      );
    }
  }

  private createSandboxRequest(): { sandboxReq: SandboxRequest; srcSandboxName: string } {
    this.logger.debug('Clone started with args %s ', this.flags);
    this.logger.debug('Clone Varargs: %s ', this.varargs);
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
      throw SfdxError.create(
        new SfdxErrorConfig('@salesforce/plugin-org', 'clone', 'missingSourceSandboxName', [
          OrgCloneCommand.SANDBOXDEF_SRC_SANDBOXNAME,
        ]).addAction('missingSourceSandboxNameAction', [OrgCloneCommand.SANDBOXDEF_SRC_SANDBOXNAME])
      );
    }
    return { sandboxReq, srcSandboxName };
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

  private readJsonDefFile(): Record<string, unknown> {
    // the -f option
    if (this.flags.definitionfile) {
      this.logger.debug('Reading JSON DefFile %s ', this.flags.definitionfile);
      return JSON.parse(fs.readFileSync(this.flags.definitionfile, 'utf-8')) as Record<string, unknown>;
    }
  }
}
