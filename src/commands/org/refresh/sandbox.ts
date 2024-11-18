/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Duration, omit } from '@salesforce/kit';
import { Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages, SandboxEvents, SandboxInfo, SfError } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import requestFunctions from '../../../shared/sandboxRequest.js';
import { SandboxCommandBase, SandboxCommandResponse } from '../../../shared/sandboxCommandBase.js';

type SandboxInfoRecord = SandboxInfo & {
  attributes: {
    type: 'SandboxInfo';
    url: string;
  };
};

// Fields of SandboxInfo
const uneditableFields = ['IsDeleted', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById'];
const fields = [
  'Id',
  'SandboxName', // (string)
  'LicenseType', // (string) DEVELOPER | DEVELOPER PRO | PARTIAL | FULL
  'TemplateId', // (string) reference to PartitionLevelScheme
  'HistoryDays', // (int)
  'CopyChatter', // (boolean)
  'AutoActivate', // (boolean)
  'ApexClassId', // (string) apex class ID
  'Description', // (string)
  'SourceId', // (string) SandboxInfoId as the source org used for a clone
  // 'ActivationUserGroupId', // Currently not supported but might be added in API v61.0
  // 'CopyArchivedActivities', -- only for full sandboxes; depends if a license was purchased
  'IsSourceTrackingSandboxesEnabled',
  ...uneditableFields,
];

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'refresh.sandbox');

export default class RefreshSandbox extends SandboxCommandBase<SandboxCommandResponse> {
  public static summary = messages.getMessage('summary');
  public static description = messages.getMessage('description');
  public static examples = messages.getMessages('examples');

  public static flags = {
    'no-auto-activate': Flags.boolean({
      summary: messages.getMessage('flags.no-auto-activate.summary'),
      description: messages.getMessage('flags.no-auto-activate.description'),
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
      parse: (name: string): Promise<string> => {
        if (name.length > 10) {
          throw messages.createError('error.SandboxNameLength', [name]);
        }
        return Promise.resolve(name);
      },
    }),
    'definition-file': Flags.file({
      exists: true,
      char: 'f',
      summary: messages.getMessage('flags.definitionFile.summary'),
      description: messages.getMessage('flags.definitionFile.description'),
    }),
    'target-org': Flags.requiredOrg({
      char: 'o',
      summary: messages.getMessage('flags.targetOrg.summary'),
      required: true,
    }),
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.noPrompt.summary'),
    }),
  };
  private flags!: Interfaces.InferredFlags<typeof RefreshSandbox.flags>;

  private sbxConfig!: SandboxInfo;

  public async run(): Promise<SandboxCommandResponse> {
    this.sandboxRequestConfig = await this.getSandboxRequestConfig();
    this.flags = (await this.parse(RefreshSandbox)).flags;
    this.validateFlags();
    this.sbxConfig = await this.resolveConfig();
    this.debug('Refresh started with args %s ', this.flags);
    return this.refreshSandbox();
  }

  protected getCheckSandboxStatusParams(): string[] {
    return [
      this.config.bin,
      ...(this.latestSandboxProgressObj ? [this.latestSandboxProgressObj.Id] : []),
      this.flags['target-org'].getUsername() as string,
    ];
  }

  private async refreshSandbox(): Promise<SandboxCommandResponse> {
    this.prodOrg = this.flags['target-org'];

    await this.confirmSandboxRefresh(this.sbxConfig);

    const lifecycle = Lifecycle.getInstance();
    this.registerLifecycleListeners(lifecycle, { isAsync: this.flags['async'], prodOrg: this.prodOrg });

    // remove uneditable fields before refresh
    const updateableSandboxInfo = omit(this.sbxConfig, uneditableFields);
    this.debug('Calling refresh with SandboxInfo: %s ', updateableSandboxInfo);
    this.initSandboxProcessData(this.sbxConfig);

    try {
      if (!this.flags.async) {
        this.spinner.start('Sandbox Refresh');
      }

      const sandboxProcessObject = await this.prodOrg.refreshSandbox(updateableSandboxInfo, {
        wait: this.flags['wait'],
        interval: this.flags['poll-interval'],
        async: this.flags['async'],
      });

      this.latestSandboxProgressObj = sandboxProcessObject;
      // persist sandbox refresh request in cache for resume
      this.sandboxRequestData = {
        prodOrgUsername: this.flags['target-org'].getUsername() as string,
        action: 'Refresh',
        sandboxProcessObject,
        sandboxRequest: this.sbxConfig,
      };
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
        err.name === 'SandboxRefreshNotCompleteError' &&
        this.latestSandboxProgressObj
      ) {
        void lifecycle.emit(SandboxEvents.EVENT_ASYNC_RESULT, undefined);
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      }
      throw err;
    }
  }

  private async resolveConfig(): Promise<SandboxInfo> {
    const defFile = this.flags['definition-file'];
    let sbxName = this.flags['name'];
    const defFileContent = defFile ? requestFunctions.readSandboxDefFile(defFile) : {};

    // Ensure we have a sandbox name.
    if (!defFileContent?.SandboxName && !sbxName) {
      throw messages.createError('error.NoSandboxName');
    }

    let apexId: string | undefined;
    let groupId: string | undefined;

    if (defFileContent.ApexClassName) {
      apexId = await requestFunctions.getApexClassIdByName(
        this.flags['target-org'].getConnection(),
        defFileContent.ApexClassName
      ); // convert  name to ID
      delete defFileContent.ApexClassName;
    }

    if (defFileContent.ActivationUserGroupName) {
      groupId = await requestFunctions.getUserGroupIdByName(
        this.flags['target-org'].getConnection(),
        defFileContent.ActivationUserGroupName
      );
      delete defFileContent.ActivationUserGroupName;
    }
    // Warn if sandbox name is in `--name` and `--definition-file` flags and they differ.
    if (defFileContent?.SandboxName && sbxName && sbxName !== defFileContent?.SandboxName) {
      this.warn(messages.createWarning('warning.ConflictingSandboxNames', [sbxName, defFileContent?.SandboxName]));
    }
    sbxName ??= defFileContent.SandboxName as string; // The code above ensures a value for sbxName

    const prodOrg = this.flags['target-org'];
    const prodOrgConnection = prodOrg.getConnection();
    let sandboxInfo: SandboxInfo;
    try {
      const soql = `SELECT ${fields.join(',')} FROM SandboxInfo WHERE SandboxName='${sbxName}'`;
      const sandboxInfoRecord = await prodOrgConnection.singleRecordQuery<SandboxInfoRecord>(soql, { tooling: true });
      sandboxInfo = omit(sandboxInfoRecord, 'attributes');
    } catch (error: unknown) {
      const err =
        error instanceof Error ? error : typeof error === 'string' ? SfError.wrap(error) : new SfError('unknown');
      if (err.name === 'SingleRecordQuery_NoRecords') {
        throw messages.createError('error.SandboxNotFound', [sbxName, prodOrg.getUsername()]);
      }
      throw err;
    }

    // assign overrides
    sandboxInfo = Object.assign(sandboxInfo, defFileContent, {
      SandboxName: sbxName,
      AutoActivate: !this.flags['no-auto-activate'],
      ...(apexId ? { ApexClassId: apexId } : {}),
      ...(groupId ? { ActivationUserGroupId: groupId } : {}),
    });

    return sandboxInfo;
  }

  // Ensure polling flags make sense
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

  private initSandboxProcessData(sandboxInfo: SandboxInfo): void {
    this.sandboxRequestData = {
      ...this.sandboxRequestData,
      prodOrgUsername: this.flags['target-org'].getUsername() as string,
      action: 'Refresh',
      sandboxProcessObject: {
        SandboxName: sandboxInfo.SandboxName,
      },
      sandboxRequest: sandboxInfo,
    };

    this.saveSandboxProgressConfig();
  }

  private async confirmSandboxRefresh(sandboxInfo: SandboxInfo): Promise<void> {
    if (this.flags['no-prompt'] || this.jsonEnabled()) return;

    const data = Object.entries(sandboxInfo).map(([key, value]) => ({ key, value: value ?? 'null' }));
    this.table({
      data,
      columns: [
        { key: 'key', name: 'Field' },
        { key: 'value', name: 'Value' },
      ],
      title: 'Config Sandbox Refresh',
    });
    if (
      !(await this.confirm({
        message: messages.getMessage('isConfigurationOk'),
        ms: 30_000,
      }))
    ) {
      throw messages.createError('error.UserNotSatisfiedWithSandboxConfig');
    }
  }
}
