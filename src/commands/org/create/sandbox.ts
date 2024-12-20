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
import requestFunctions, { readSandboxDefFile } from '../../../shared/sandboxRequest.js';
import { SandboxCommandBase, SandboxCommandResponse } from '../../../shared/sandboxCommandBase.js';
import { SandboxLicenseType } from '../../../shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create.sandbox');

const getLicenseTypes = (): string[] => Object.values(SandboxLicenseType);

type SandboxConfirmData = SandboxRequest & { CloneSource?: string };

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
      summary: messages.getMessage('flags.source-sandbox-name.summary'),
      description: messages.getMessage('flags.source-sandbox-name.description'),
      exclusive: ['license-type', 'source-id'],
      deprecateAliases: true,
      aliases: ['clone', 'c'],
    }),
    'source-id': Flags.salesforceId({
      summary: messages.getMessage('flags.source-id.summary'),
      description: messages.getMessage('flags.source-id.description'),
      exclusive: ['license-type'],
      length: 'both',
      char: undefined,
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
      ...(this.flags['source-sandbox-name']
        ? { SourceSandboxName: this.flags['source-sandbox-name'] }
        : this.flags['source-id']
        ? { SourceId: this.flags['source-id'] }
        : {}),
      ...(!this.flags['source-sandbox-name'] && !this.flags['source-id'] && this.flags['license-type']
        ? { LicenseType: this.flags['license-type'] }
        : {}),
    };

    const { sandboxReq, srcSandboxName, srcId } = await requestFunctions.createSandboxRequest(
      this.flags['definition-file'],
      undefined,
      requestOptions
    );

    let apexId: string | undefined;
    let groupId: string | undefined;

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

    return {
      ...sandboxReq,
      ...(srcSandboxName
        ? { SourceId: await requestFunctions.getSrcIdByName(this.flags['target-org'].getConnection(), srcSandboxName) }
        : {}),
      ...(srcId ? { SourceId: srcId } : {}),
      ...(apexId ? { ApexClassId: apexId } : {}),
      ...(groupId ? { ActivationUserGroupId: groupId } : {}),
    };
  }

  private async createSandbox(): Promise<SandboxCommandResponse> {
    const lifecycle = Lifecycle.getInstance();
    this.prodOrg = this.flags['target-org'];

    const sandboxReq = await this.createSandboxRequest();
    await this.confirmSandboxReq({
      ...sandboxReq,
    });
    this.initSandboxProcessData(sandboxReq);

    this.registerLifecycleListeners(lifecycle, {
      isAsync: this.flags.async,
      setDefault: this.flags['set-default'],
      alias: this.flags.alias,
      prodOrg: this.prodOrg,
      tracksSource: this.flags['no-track-source'] === true ? false : undefined,
    });

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
    this.table({
      data,
      columns: [
        { key: 'key', name: 'Field' },
        { key: 'value', name: 'Value' },
      ],
      title: 'Config Sandbox Request',
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
    if (!this.flags['definition-file']) {
      return undefined;
    }
    const parsedDef = readSandboxDefFile(this.flags['definition-file']);
    if (this.flags['source-id'] && parsedDef.SourceId) {
      throw messages.createError('error.bothIdFlagAndDefFilePropertyAreProvided');
    }
    if (this.flags['source-sandbox-name'] && parsedDef.SourceSandboxName) {
      throw messages.createError('error.bothNameFlagAndDefFilePropertyAreProvided');
    }
    if (this.flags['source-id'] && parsedDef.SourceSandboxName) {
      throw messages.createError('error.bothIdFlagAndNameDefFileAreNotAllowed');
    }
    if (this.flags['source-sandbox-name'] && parsedDef.SourceId) {
      throw messages.createError('error.bothIdFlagAndNameDefFileAreNotAllowed');
    }
  }
}
