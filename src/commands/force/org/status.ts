/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import {
  Config,
  Lifecycle,
  Messages,
  StateAggregator,
  SandboxEvents,
  SfdxPropertyKeys,
  StatusEvent,
  ResultEvent,
  SandboxProcessObject,
} from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { SandboxReporter } from '../../../shared/sandboxReporter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'status');

export class OrgStatusCommand extends SfdxCommand {
  public static readonly examples = messages.getMessage('examples').split(EOL);
  public static readonly description = messages.getMessage('description');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;

  public static readonly flagsConfig: FlagsConfig = {
    sandboxname: flags.string({
      char: 'n',
      description: messages.getMessage('flags.sandboxname'),
      required: true,
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
      min: Duration.minutes(2),
      default: Duration.minutes(6),
    }),
  };

  public async run(): Promise<SandboxProcessObject> {
    this.logger.debug('Status started with args %s ', this.flags);
    const lifecycle = Lifecycle.getInstance();

    // eslint-disable-next-line @typescript-eslint/require-await
    lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) => {
      this.ux.log(SandboxReporter.sandboxProgress(results));
    });

    lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
      const resultMsg = `Sandbox ${results.sandboxProcessObj.SandboxName}(${results.sandboxProcessObj.Id}) is ready for use.`;
      this.ux.log(resultMsg);
      const { data } = SandboxReporter.logSandboxProcessResult(results);
      this.ux.styledHeader('Sandbox Org Status');
      this.ux.table(data, {
        key: { header: 'Name' },
        value: { header: 'Value' },
      });
      if (results.sandboxRes?.authUserName) {
        if (this.flags.setalias) {
          const stateAggregator = await StateAggregator.getInstance();
          stateAggregator.aliases.set(this.flags.setalias, results.sandboxRes.authUserName);
          this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, results.sandboxRes.authUserName);
        }
        if (this.flags.setdefaultusername) {
          const globalConfig: Config = this.configAggregator.getGlobalConfig();
          globalConfig.set(SfdxPropertyKeys.DEFAULT_USERNAME, results.sandboxRes.authUserName);
          const result = await globalConfig.write();
          this.logger.debug('Set defaultUsername: %s result: %s', this.flags.setdefaultusername, result);
        }
      }
    });

    this.logger.debug('Calling auth for SandboxName args: %s ', this.flags.sandboxname);
    const results = await this.org.sandboxStatus(this.flags.sandboxname, { wait: this.flags.wait as Duration });
    this.logger.debug('Results for auth call: %s ', results);
    if (!results) {
      this.ux.styledHeader('Sandbox Org Creation Status');
      this.ux.log('No SandboxProcess Result Found');
    }
    return results;
  }
}
