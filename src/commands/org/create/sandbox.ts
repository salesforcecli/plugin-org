/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-console */

import { Duration } from '@salesforce/kit';
import { Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages, SandboxEvents, SandboxProcessObject, SandboxRequest, SfError } from '@salesforce/core';
import { Ux } from '@salesforce/sf-plugins-core';
import { Interfaces } from '@oclif/core';
import requestFunctions from '../../../shared/sandboxRequest.js';
import { SandboxCommandBase } from '../../../shared/sandboxCommandBase.js';
import { SandboxLicenseType } from '../../../shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create.sandbox');

const getLicenseTypes = (): string[] => Object.values(SandboxLicenseType);

type SandboxConfirmData = SandboxRequest & { CloneSource?: string };

export default class CreateSandbox extends SandboxCommandBase<SandboxProcessObject> {
  public static summary = messages.getMessage('summary');
  public static description = messages.getMessage('description');
  public static examples = messages.getMessages('examples');
  public static readonly aliases = ['env:create:sandbox'];
  public static readonly deprecateAliases = true;

  public static flags = {
    // needs to change when new flags are available
    'definition-file': Flags.file({
      exists: true,
      char: 'f',
      summary: messages.getMessage('flags.definitionFile.summary'),
      description: messages.getMessage('flags.definitionFile.description'),
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
      default: Duration.minutes(30),
      helpValue: '<minutes>',
      exclusive: ['async'],
    }),
    'poll-interval': Flags.duration({
      char: 'i',
      summary: messages.getMessage('flags.poll-interval.summary'),
      min: 15,
      unit: 'seconds',
      default: Duration.seconds(30),
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
    'license-type': Flags.custom<SandboxLicenseType>({
      options: getLicenseTypes(),
    })({
      char: 'l',
      summary: messages.getMessage('flags.licenseType.summary'),
      exclusive: ['clone'],
    }),
    'target-org': Flags.requiredOrg({
      char: 'o',
      summary: messages.getMessage('flags.targetOrg.summary'),
      description: messages.getMessage('flags.targetOrg.description'),
      required: true,
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
  private flags!: Interfaces.InferredFlags<typeof CreateSandbox.flags>;

  public async run(): Promise<SandboxProcessObject> {
    this.sandboxRequestConfig = await this.getSandboxRequestConfig();
    this.flags = (await this.parse(CreateSandbox)).flags;
    this.debug('Create started with args %s ', this.flags);
    this.validateFlags();
    return this.createSandbox();
  }

  protected getCheckSandboxStatusParams(): string[] {
    return [
      this.config.bin,
      ...(this.latestSandboxProgressObj ? [this.latestSandboxProgressObj.Id] : []),
      this.flags['target-org'].getUsername() as string,
    ];
  }

  private async createSandboxRequest(): Promise<SandboxRequest> {
    // reuse the existing sandbox request generator, with this command's flags as the varargs
    const requestOptions = {
      ...(this.flags.name ? { SandboxName: this.flags.name } : {}),
      ...(this.flags.clone ? { SourceSandboxName: this.flags.clone } : {}),
      ...(!this.flags.clone && this.flags['license-type'] ? { LicenseType: this.flags['license-type'] } : {}),
    };
    const { sandboxReq } = !this.flags.clone
      ? await requestFunctions.createSandboxRequest(false, this.flags['definition-file'], undefined, requestOptions)
      : await requestFunctions.createSandboxRequest(true, this.flags['definition-file'], undefined, requestOptions);
    return {
      ...sandboxReq,
      ...(this.flags.clone ? { SourceId: await this.getSourceId() } : {}),
    };
  }

  private async createSandbox(): Promise<SandboxProcessObject> {
    const lifecycle = Lifecycle.getInstance();

    this.registerLifecycleListeners(lifecycle, {
      isAsync: this.flags.async,
      setDefault: this.flags['set-default'],
      alias: this.flags.alias,
      prodOrg: this.flags['target-org'],
      tracksSource: this.flags['no-track-source'] === true ? false : undefined,
    });
    const sandboxReq = await this.createSandboxRequest();
    await this.confirmSandboxReq({ ...sandboxReq, ...(this.flags.clone ? { CloneSource: this.flags.clone } : {}) });
    await this.initSandboxProcessData(sandboxReq);

    if (!this.flags.async) {
      this.spinner.start('Sandbox Create');
    }

    this.debug('Calling create with SandboxRequest: %s ', sandboxReq);

    try {
      const sandboxProcessObject = await this.flags['target-org'].createSandbox(sandboxReq, {
        wait: this.flags.wait,
        interval: this.flags['poll-interval'],
        async: this.flags.async,
      });
      // console.log('Assigning this.latestSandboxProgressObj from command (below)');
      // console.dir(sandboxProcessObject, { depth: 8 });
      this.latestSandboxProgressObj = sandboxProcessObject;
      await this.saveSandboxProgressConfig();
      if (this.flags.async) {
        process.exitCode = 68;
      }
      return sandboxProcessObject;
    } catch (err) {
      this.spinner.stop();
      if (this.pollingTimeOut && this.latestSandboxProgressObj) {
        void lifecycle.emit(SandboxEvents.EVENT_ASYNC_RESULT, undefined);
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      } else if (
        err instanceof SfError &&
        err.name === 'SandboxCreateNotCompleteError' &&
        this.latestSandboxProgressObj
      ) {
        void lifecycle.emit(SandboxEvents.EVENT_ASYNC_RESULT, undefined);
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      }
      throw err;
    }
  }

  private async initSandboxProcessData(sandboxReq: SandboxRequest): Promise<void> {
    this.sandboxRequestData = {
      ...this.sandboxRequestData,
      alias: this.flags.alias,
      setDefault: this.flags['set-default'],
      prodOrgUsername: this.flags['target-org'].getUsername() as string,
      action: 'Create',
      sandboxProcessObject: {
        SandboxName: sandboxReq.SandboxName,
      },
      sandboxRequest: sandboxReq,
      tracksSource: this.flags['no-track-source'] === true ? false : undefined,
    };

    return this.saveSandboxProgressConfig();
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

    if (
      !(await this.confirm({
        message: messages.getMessage('isConfigurationOk'),
      }))
    ) {
      throw messages.createError('error.UserNotSatisfiedWithSandboxConfig');
    }
  }

  private validateFlags(): void {
    if (!this.flags['poll-interval'] || !this.flags.wait) {
      return;
    }
    if (this.flags['poll-interval'].seconds > this.flags.wait.seconds) {
      throw messages.createError('error.pollIntervalGreaterThanWait', [
        this.flags['poll-interval'].seconds,
        this.flags.wait.seconds,
      ]);
    }
  }

  private async getSourceId(): Promise<string | undefined> {
    if (!this.flags.clone) {
      return undefined;
    }
    try {
      const sourceOrg = await this.flags['target-org'].querySandboxProcessBySandboxName(this.flags.clone);
      return sourceOrg.SandboxInfoId;
    } catch (err) {
      throw messages.createError('error.noCloneSource', [this.flags.clone], [], err as Error);
    }
  }
}
