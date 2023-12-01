/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
  orgApiVersionFlagWithDeprecations,
  loglevel,
} from '@salesforce/sf-plugins-core';
import {
  Config,
  Lifecycle,
  Messages,
  StateAggregator,
  SandboxEvents,
  OrgConfigProperties,
  StatusEvent,
  ResultEvent,
  SandboxProcessObject,
  Logger,
} from '@salesforce/core';
import { SandboxReporter } from '../../../shared/sandboxReporter.js';

Messages.importMessagesDirectory(dirname(fileURLToPath(import.meta.url)));
const messages = Messages.loadMessages('@salesforce/plugin-org', 'status');

export class OrgStatusCommand extends SfCommand<SandboxProcessObject> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static state = 'deprecated';
  public static deprecationOptions = {
    to: 'org:resume:sandbox',
    version: '60.0',
  };

  public static readonly flags = {
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': orgApiVersionFlagWithDeprecations,
    sandboxname: Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.sandboxname.summary'),
      required: true,
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
      min: 2,
      defaultValue: 6,
    }),
    loglevel,
  };

  public async run(): Promise<SandboxProcessObject> {
    const { flags } = await this.parse(OrgStatusCommand);
    flags['target-org'].getConnection(flags['api-version']);
    const logger = await Logger.child(this.constructor.name);
    logger.debug('Status started with args %s ', flags);
    const lifecycle = Lifecycle.getInstance();

    lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) =>
      Promise.resolve(this.log(SandboxReporter.sandboxProgress(results)))
    );

    lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
      const resultMsg = `Sandbox ${results.sandboxProcessObj.SandboxName}(${results.sandboxProcessObj.Id}) is ready for use.`;
      this.log(resultMsg);
      const { data } = SandboxReporter.logSandboxProcessResult(results);
      this.styledHeader('Sandbox Org Status');
      this.table(data, {
        key: { header: 'Name' },
        value: { header: 'Value' },
      });
      if (results.sandboxRes?.authUserName) {
        if (flags.setalias) {
          const stateAggregator = await StateAggregator.getInstance();
          stateAggregator.aliases.set(flags.setalias, results.sandboxRes.authUserName);
          await stateAggregator.aliases.write();
          logger.debug('Set Alias: %s result: %s', flags.setalias, results.sandboxRes.authUserName);
        }
        if (flags.setdefaultusername) {
          const globalConfig: Config = this.configAggregator.getGlobalConfig();
          globalConfig.set(OrgConfigProperties.TARGET_ORG, results.sandboxRes.authUserName);
          const result = await globalConfig.write();
          logger.debug('Set defaultUsername: %s result: %s', flags.setdefaultusername, result);
        }
      }
    });

    logger.debug('Calling auth for SandboxName args: %s ', flags.sandboxname);
    const results = await flags['target-org'].sandboxStatus(flags.sandboxname, {
      wait: flags.wait,
    });
    logger.debug('Results for auth call: %s ', results);
    if (!results) {
      this.styledHeader('Sandbox Org Creation Status');
      this.log('No SandboxProcess Result Found');
    }
    return results;
  }
}
