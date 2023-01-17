/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { Flags } from '@salesforce/sf-plugins-core';
import {
  Lifecycle,
  Messages,
  Org,
  SandboxEvents,
  SandboxProcessObject,
  SandboxRequest,
  SfError,
} from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { Ux } from '@salesforce/sf-plugins-core/lib/ux';
import * as Interfaces from '@oclif/core/lib/interfaces';
import { SandboxCommandBase } from '../../../shared/sandboxCommandBase';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-env', 'create.sandbox');

type CmdFlags = {
  'definition-file': string;
  'set-default': boolean;
  alias: string;
  async: boolean;
  'poll-interval': Duration;
  wait: Duration;
  name: string;
  'license-type': string;
  'no-prompt': boolean;
  'target-org': Org;
  clone: string;
  json: boolean;
  'no-track-source': boolean;
};

export enum SandboxLicenseType {
  developer = 'Developer',
  developerPro = 'Developer_Pro',
  partial = 'Partial',
  full = 'Full',
}

const getLicenseTypes = (): string[] => Object.values(SandboxLicenseType);

type SandboxConfirmData = SandboxRequest & { CloneSource?: string };

export default class CreateSandbox extends SandboxCommandBase<SandboxProcessObject> {
  public static summary = messages.getMessage('summary');
  public static description = messages.getMessage('description');
  public static examples = messages.getMessages('examples');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static flags: Interfaces.FlagInput<Omit<CmdFlags, 'json'>> = {
    // needs to change when new flags are available
    'definition-file': Flags.file({
      exists: true,
      char: 'f',
      summary: messages.getMessage('flags.definitionFile.summary'),
      description: messages.getMessage('flags.definitionFile.description'),
      exclusive: ['name', 'license-type'],
    }),
    'set-default': Flags.boolean({
      char: 's',
      summary: messages.getMessage('flags.setDefault.summary'),
    }),
    alias: Flags.string({
      char: 'a',
      summary: messages.getMessage('flags.alias.summary'),
      description: messages.getMessage('flags.alias.description'),
    }),
    wait: Flags.duration({
      char: 'w',
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
      min: 1,
      unit: 'minutes',
      defaultValue: 30,
      helpValue: '<minutes>',
      exclusive: ['async'],
    }),
    'poll-interval': Flags.duration({
      char: 'i',
      summary: messages.getMessage('flags.poll-interval.summary'),
      min: 15,
      unit: 'seconds',
      defaultValue: 30,
      helpValue: '<seconds>',
      exclusive: ['async'],
    }),
    async: Flags.boolean({
      summary: messages.getMessage('flags.async.summary'),
      description: messages.getMessage('flags.async.description'),
      exclusive: ['wait', 'poll-interval'],
    }),
    name: Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      exclusive: ['definition-file'],
      parse: (name: string): Promise<string> => {
        if (name.length > 10) {
          throw messages.createError('error.SandboxNameLength', [name]);
        }
        return Promise.resolve(name);
      },
    }),
    clone: Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.clone.summary'),
      description: messages.getMessage('flags.clone.description'),
      exclusive: ['license-type'],
    }),
    'license-type': Flags.enum({
      char: 'l',
      summary: messages.getMessage('flags.licenseType.summary'),
      exclusive: ['definition-file', 'clone'],
      options: getLicenseTypes(),
      default: SandboxLicenseType.developer,
    }),
    'target-org': Flags.requiredOrg({
      char: 'o',
      summary: messages.getMessage('flags.targetOrg.summary'),
      description: messages.getMessage('flags.targetOrg.description'),
    }),
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.noPrompt.summary'),
    }),
    'no-track-source': Flags.boolean({
      summary: messages.getMessage('flags.no-track-source.summary'),
      description: messages.getMessage('flags.no-track-source.description'),
      allowNo: false,
    }),
  };
  public static readonly state = 'beta';
  protected readonly lifecycleEventNames = ['postorgcreate'];
  private flags: CmdFlags;

  public async run(): Promise<SandboxProcessObject> {
    this.sandboxRequestConfig = await this.getSandboxRequestConfig();
    this.flags = (await this.parse(CreateSandbox)).flags as CmdFlags;
    this.debug('Create started with args %s ', this.flags);
    this.validateFlags();
    return this.createSandbox();
  }

  protected getCheckSandboxStatusParams(): string[] {
    return [this.latestSandboxProgressObj.Id, this.flags['target-org'].getUsername()];
  }

  private async createSandboxRequest(prodOrg: Org): Promise<SandboxRequest> {
    let sandboxDefFileContents = this.readJsonDefFile() || {};

    if (sandboxDefFileContents) {
      sandboxDefFileContents = lowerToUpper(sandboxDefFileContents);
    }

    // build sandbox request from data provided
    const sandboxReq: SandboxRequest = {
      SandboxName: undefined,
      ...sandboxDefFileContents,
      ...Object.assign({}, this.flags.name ? { SandboxName: this.flags.name } : {}),
      ...Object.assign(
        {},
        sandboxDefFileContents['LicenseType']
          ? { LicenseType: sandboxDefFileContents['LicenseType'] as string }
          : { LicenseType: this.flags['license-type'] }
      ),
    };

    if (!sandboxReq.SandboxName) {
      // sandbox names are 10 chars or less, a radix of 36 = [a-z][0-9]
      // see https://help.salesforce.com/s/articleView?id=sf.data_sandbox_create.htm&type=5 for sandbox naming criteria
      // technically without querying the production org, the generated name could already exist,
      // but the chances of that are lower than the perf penalty of querying and verifying
      sandboxReq.SandboxName = `sbx${Date.now().toString(36).slice(-7)}`;
      this.info(messages.createWarning('warning.NoSandboxNameDefined', [sandboxReq.SandboxName]));
    }

    const sourceId = await this.getSourceId(prodOrg);
    if (sourceId) {
      sandboxReq.SourceId = sourceId;
      delete sandboxReq.LicenseType;
    }
    return sandboxReq;
  }

  private async createSandbox(): Promise<SandboxProcessObject> {
    this.prodOrg = this.flags['target-org'];
    const lifecycle = Lifecycle.getInstance();

    this.registerLifecycleListeners(lifecycle, {
      isAsync: this.flags.async,
      setDefault: this.flags['set-default'],
      alias: this.flags.alias,
      prodOrg: this.prodOrg,
      tracksSource: this.flags['no-track-source'] === true ? false : undefined,
    });
    const sandboxReq = await this.createSandboxRequest(this.prodOrg);
    await this.confirmSandboxReq({ ...sandboxReq, ...(this.flags.clone ? { CloneSource: this.flags.clone } : {}) });
    this.initSandboxProcessData(this.prodOrg, sandboxReq);

    if (!this.flags.async) {
      this.spinner.start('Sandbox Create');
    }

    this.debug('Calling create with SandboxRequest: %s ', sandboxReq);

    try {
      const sandboxProcessObject = await this.prodOrg.createSandbox(sandboxReq, {
        wait: this.flags.wait,
        interval: this.flags['poll-interval'],
        async: this.flags.async,
      });
      this.latestSandboxProgressObj = sandboxProcessObject;
      this.saveSandboxProgressConfig();
      if (this.flags.async) {
        process.exitCode = 68;
      }
      return sandboxProcessObject;
    } catch (err) {
      this.spinner.stop();
      const error = err as SfError;
      if (this.pollingTimeOut) {
        void lifecycle.emit(SandboxEvents.EVENT_ASYNC_RESULT, undefined);
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      } else if (error.name === 'SandboxCreateNotCompleteError') {
        void lifecycle.emit(SandboxEvents.EVENT_ASYNC_RESULT, undefined);
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      }
      throw err;
    }
  }

  private initSandboxProcessData(prodOrg: Org, sandboxReq: SandboxRequest): void {
    this.sandboxRequestData.alias = this.flags.alias;
    this.sandboxRequestData.setDefault = this.flags['set-default'];
    this.sandboxRequestData.prodOrgUsername = prodOrg.getUsername();
    this.sandboxRequestData.sandboxProcessObject.SandboxName = sandboxReq.SandboxName;
    this.sandboxRequestData.sandboxRequest = sandboxReq;
    this.sandboxRequestData.tracksSource = this.flags['no-track-source'] === true ? false : undefined;
    this.saveSandboxProgressConfig();
  }

  private readJsonDefFile(): Record<string, unknown> {
    // the -f option
    if (this.flags['definition-file']) {
      this.debug('Reading JSON DefFile %s ', this.flags['definition-file']);
      return JSON.parse(fs.readFileSync(this.flags['definition-file'], 'utf-8')) as Record<string, unknown>;
    }
  }

  private async confirmSandboxReq(sandboxReq: SandboxConfirmData): Promise<void> {
    if (this.flags['no-prompt'] || this.jsonEnabled()) return;

    const columns: Ux.Table.Columns<{ key: string; value: unknown }> = {
      key: { header: 'Field' },
      value: { header: 'Value' },
    };

    const data = Object.entries(sandboxReq).map(([key, value]) => ({ key, value }));
    this.styledHeader('Config Sandbox Request');
    this.table(data, columns, {});

    const configurationCorrect = await this.timedPrompt<{ continue: boolean }>(
      [
        {
          name: 'continue',
          type: 'confirm',
          message: messages.getMessage('isConfigurationOk'),
        },
      ],
      10_000
    );
    if (!configurationCorrect.continue) {
      throw messages.createError('error.UserNotSatisfiedWithSandboxConfig');
    }
  }

  private validateFlags(): void {
    if (this.flags['poll-interval'].seconds > this.flags.wait.seconds) {
      throw messages.createError('error.pollIntervalGreaterThanWait', [
        this.flags['poll-interval'].seconds,
        this.flags.wait.seconds,
      ]);
    }
  }

  private async getSourceId(prodOrg: Org): Promise<string> {
    if (!this.flags.clone) {
      return undefined;
    }
    try {
      const sourceOrg = await prodOrg.querySandboxProcessBySandboxName(this.flags.clone);
      return sourceOrg.SandboxInfoId;
    } catch (err) {
      throw messages.createError('error.noCloneSource', [this.flags.clone], [], err as Error);
    }
  }
}

const lowerToUpper = (object: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(object).map(([k, v]) => [`${k.charAt(0).toUpperCase()}${k.slice(1)}`, v]));
