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
  Lifecycle,
  Messages,
  Org,
  SfdxError,
  OrgTypes,
  SandboxEvents,
  SandboxProcessObject,
  SandboxRequest,
  SandboxUserAuthResponse,
  Aliases,
  Config,
} from '@salesforce/core';
import { SandboxReporter } from '../../../../shared/sandboxReporter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create');

enum EnvTypes {
  Sandbox = 'sandbox',
  Virtual = 'virtual',
  Prototype = 'prototype',
}

export class Create extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly supportsDevhubUsername = true;
  public static readonly supportsUsername = true;
  public static readonly varargs = true;
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
    definitionjson: flags.string({
      char: 'j',
      description: messages.getMessage('flags.definitionJson'),
      hidden: true,
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
    env: flags.enum({
      char: 'e',
      description: messages.getMessage('flags.env', [
        [`${EnvTypes.Sandbox}*`, EnvTypes.Virtual, EnvTypes.Prototype].join(),
      ]),
      hidden: true,
      options: [`${EnvTypes.Sandbox}*`, EnvTypes.Virtual, EnvTypes.Prototype],
      default: EnvTypes.Sandbox,
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
    }),
    retry: flags.number({
      hidden: true,
      default: 0,
      max: 10,
      description: messages.getMessage('flags.retry'),
    }),
  };
  protected readonly lifecycleEventNames = ['postorgcreate'];

  // TODO: union type of sandbox and scratch org
  public async run(): Promise<SandboxProcessObject> {
    this.logger.debug('Create started with args %s ', this.flags);

    if (this.flags.type === OrgTypes.Sandbox) {
      if (this.flags.retry !== 0) {
        throw SfdxError.create('@salesforce/plugin-org', 'create', 'retryIsNotValidForSandboxes');
      }
      if (this.flags.clientid) {
        this.ux.warn(messages.getMessage('clientIdNotSupported', [this.flags.clientid]));
      }
      return this.createSandbox();
    } else {
      // default to scratch org
      this.createScratchOrg();
    }
  }

  private async createSandbox(): Promise<SandboxProcessObject> {
    const prodOrg = await Org.create({ aliasOrUsername: this.flags.targetusername as string });
    const lifecycle = Lifecycle.getInstance();

    // register the sandbox event listeners before calling `prodOrg.createSandbox()`

    // `on` doesn't support synchronous methods
    // eslint-disable-next-line @typescript-eslint/require-await
    lifecycle.on(SandboxEvents.EVENT_ASYNC_RESULT, async (results: SandboxProcessObject) => {
      this.ux.log(messages.getMessage('sandboxSuccess', [results.Id, results.SandboxName]));
    });

    lifecycle.on(
      SandboxEvents.EVENT_STATUS,
      async (results: {
        sandboxProcessObj: SandboxProcessObject;
        interval: Duration.Unit.SECONDS;
        retries: number;
        waitingOnAuth: boolean;
        // eslint-disable-next-line @typescript-eslint/require-await
      }) => {
        this.ux.log(
          SandboxReporter.sandboxProgress({
            sandboxProcessObject: results.sandboxProcessObj,
            waitingOnAuth: results.waitingOnAuth,
            retriesLeft: results.retries,
            pollIntervalInSecond: results.interval,
          })
        );
      }
    );

    lifecycle.on(
      SandboxEvents.EVENT_RESULT,
      async (results: { sandboxProcessObj: SandboxProcessObject; sandboxRes: SandboxUserAuthResponse }) => {
        const { sandboxReadyForUse, data } = SandboxReporter.logSandboxProcessResult(
          results.sandboxProcessObj,
          results.sandboxRes
        );
        this.ux.log(sandboxReadyForUse);
        this.ux.styledHeader('Sandbox Org Creation Status');
        this.ux.table(data, {
          columns: [
            { key: 'key', label: 'Name' },
            { key: 'value', label: 'Value' },
          ],
        });
        if (results.sandboxRes?.authUserName) {
          if (this.flags.setalias) {
            const alias = await Aliases.create({});
            alias.set(this.flags.setalias, results.sandboxRes.authUserName);
            const result = await alias.write();
            this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, result);
          }
          if (this.flags.setdefaultusername) {
            const globalConfig: Config = this.configAggregator.getGlobalConfig();
            globalConfig.set(Config.DEFAULT_USERNAME, results.sandboxRes.authUserName);
            const result = await globalConfig.write();
            this.logger.debug('Set defaultUsername: %s result: %s', this.flags.setdefaultusername, result);
          }
        }
      }
    );

    const sandboxDefFileContents = this.readJsonDefFile();
    this.logger.debug('Create Varargs: %s ', this.varargs);
    // definitionjson and varargs override file input
    const sandboxReq: SandboxRequest = { SandboxName: undefined, ...sandboxDefFileContents, ...this.varargs };

    this.logger.debug('Calling create with SandboxRequest: %s ', sandboxReq);

    return prodOrg.createSandbox(sandboxReq, this.flags.wait);
  }

  private readJsonDefFile(): Record<string, unknown> {
    // the -f option
    if (this.flags.definitionfile) {
      this.logger.debug('Reading JSON DefFile %s ', this.flags.definitionfile);
      return JSON.parse(fs.readFileSync(this.flags.definitionfile, 'utf-8')) as Record<string, unknown>;
    }
  }

  private createScratchOrg(): void {
    //
  }
}
