/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Duration } from '@salesforce/kit';
import { Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages, SandboxEvents, SandboxRequest, SfError } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import requestFunctions from '../../../shared/sandboxRequest.js';
import { SandboxCommandBase, SandboxCommandResponse } from '../../../shared/sandboxCommandBase.js';
import { SandboxLicenseType } from '../../../shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create.sandbox');

const getLicenseTypes = (): string[] => Object.values(SandboxLicenseType);

type SandboxConfirmData = SandboxRequest & { CloneSource?: string };

// eslint-disable-next-line sf-plugin/only-extend-SfCommand
export default class CreateSandbox extends SandboxCommandBase<SandboxCommandResponse> {
  public static summary = messages.getMessage('summary');
  public static description = messages.getMessage('description');
  public static examples = messages.getMessages('examples');
  public static readonly aliases = ['env:create:sandbox'];
  public static readonly deprecateAliases = true;

  // eslint-disable-next-line sf-plugin/spread-base-flags
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
    'source-sandbox-name': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.source-sandbox-name.summary'),
      description: messages.getMessage('flags.source-sandbox-name.description'),
      exclusive: ['license-type', 'source-id'],
      deprecateAliases: true,
      aliases: ['clone'], // Keep 'clone' as a deprecated alias
    }),
    'source-id': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.source-id.summary'),
      description: messages.getMessage('flags.source-id.description'),
      exclusive: ['license-type'],
    }),
    'license-type': Flags.custom<SandboxLicenseType>({
      options: getLicenseTypes(),
    })({
      char: 'l',
      summary: messages.getMessage('flags.licenseType.summary'),
      exclusive: ['source-sandbox-name', 'source-id'],
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

  public async run(): Promise<SandboxCommandResponse> {
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
      ...(this.flags['source-sandbox-name'] ? { SourceSandboxName: this.flags['source-sandbox-name'] } : (this.flags['source-id'] ? { SourceSandboxId: this.flags['source-id'] } : {})),
      ...(!this.flags['source-sandbox-name'] && !this.flags['source-id'] && this.flags['license-type'] ? { LicenseType: this.flags['license-type'] } : {}),
    };
    console.log(requestOptions);
    const { sandboxReq } = !this.flags['source-id'] && !this.flags['source-sandbox-name'] // if no sourceID or sourceSandboxName, sf will create e a new sandbox
      ? await requestFunctions.createSandboxRequest(false, this.flags['definition-file'], undefined, requestOptions)
      : await requestFunctions.createSandboxRequest(true, this.flags['definition-file'], undefined, requestOptions);

    let apexId: string | undefined;
    let groupId: string | undefined;
    // Determine which value to use
    if (sandboxReq.ApexClassName) {
      apexId = await requestFunctions.getApexClassIdByName(
        this.flags['target-org'].getConnection(),
        sandboxReq.ApexClassName
      ); // convert  name to ID
      delete sandboxReq.ApexClassName;
    }
    if (sandboxReq.ActivationUserGroupName) {
      groupId = await requestFunctions.getUserGroupIdByName(
        this.flags['target-org'].getConnection(),
        sandboxReq.ActivationUserGroupName
      );
      delete sandboxReq.ActivationUserGroupName;
    }
    let srcId: string | undefined;
    return {
      ...sandboxReq,
      ...(this.flags['source-sandbox-name'] ? { SourceId: await this.getSourceIdByName() } : {}),
      ...(this.flags['source-id'] ? { SourceId: await this.getSourceId() } : {}),
      ...(apexId ? { ApexClassId: apexId } : {}),
      ...(groupId ? { ActivationUserGroupId: groupId } : {}),
      ...(srcId ? { SourceId: srcId } : {}),
    };
  }

  private async createSandbox(): Promise<SandboxCommandResponse> {
    const lifecycle = Lifecycle.getInstance();

    this.prodOrg = this.flags['target-org'];

    this.registerLifecycleListeners(lifecycle, {
      isAsync: this.flags.async,
      setDefault: this.flags['set-default'],
      alias: this.flags.alias,
      prodOrg: this.prodOrg,
      tracksSource: this.flags['no-track-source'] === true ? false : undefined,
    });
    const sandboxReq = await this.createSandboxRequest();
    await this.confirmSandboxReq({ ...sandboxReq, ...(this.flags['source-sandbox-name'] ? { CloneSource: this.flags['source-sandbox-name'] } : (this.flags['source-id'] ? { CloneSource: this.flags['source-id'] } : {})) });
    this.initSandboxProcessData(sandboxReq);

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
      return this.getSandboxCommandResponse();
    } catch (err) {
      this.spinner.stop();
      if (this.pollingTimeOut && this.latestSandboxProgressObj) {
        void lifecycle.emit(SandboxEvents.EVENT_ASYNC_RESULT, undefined);
        process.exitCode = 68;
        return this.getSandboxCommandResponse();
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

  private initSandboxProcessData(sandboxReq: SandboxRequest): void {
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

    this.saveSandboxProgressConfig();
  }

  private async confirmSandboxReq(sandboxReq: SandboxConfirmData): Promise<void> {
    if (this.flags['no-prompt'] || this.jsonEnabled()) return;

    const data = Object.entries(sandboxReq).map(([key, value]) => ({ key, value }));
    this.styledHeader('Config Sandbox Request');
    this.table(data, {
      key: { header: 'Field' },
      value: { header: 'Value' },
    });

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

  private async getSourceIdByName(): Promise<string | undefined> {
    if (!this.flags['source-sandbox-name']) {
      return undefined;
    }
    try {
      const sourceOrg = await this.flags['target-org'].querySandboxProcessBySandboxName(this.flags['source-sandbox-name']);
      return sourceOrg.SandboxInfoId;
    } catch (err) {
      throw messages.createError('error.noCloneSource', [this.flags['source-sandbox-name']], [], err as Error);
    }
  }

  private async getSourceId(): Promise<string | undefined>{
    if (!this.flags['source-id']) {
      return undefined;
    }
    try {
      const sourceOrg = await this.flags['target-org'].querySandboxProcessBySandboxInfoId(this.flags['source-id']);
      return sourceOrg.SandboxInfoId;
    } catch (err) {
      throw messages.createError('error.noCloneSource', [this.flags['source-id']], [], err as Error);
    }
  }
}
