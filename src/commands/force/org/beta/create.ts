/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Duration } from '@salesforce/kit';

import { Messages, SfdxError } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create');

export enum OrgTypes {
  Scratch = 'scratch',
  Sandbox = 'sandbox',
}

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

  // TODO: find return types for scratch/sandbox org signup
  public async run(): Promise<void> {
    this.logger.debug('Create started with args %s ', this.flags);

    if (this.flags.type === OrgTypes.Sandbox) {
      if (this.flags.retry !== 0) {
        throw SfdxError.create('@salesforce/plugin-org', 'create', 'RetryIsNotValidForSandboxes');
      }
      if (this.flags.clientid) {
        this.ux.warn(messages.getMessage('clientIdNotSupported', [this.flags.clientid]));
      }
      await this.createSandbox();
    } else {
      // default to scratch org
      this.createScratchOrg();
    }
  }

  private async createSandbox(): Promise<void> {
    //
  }

  private createScratchOrg(): void {
    //
  }
}
