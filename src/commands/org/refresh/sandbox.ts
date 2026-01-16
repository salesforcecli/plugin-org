/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Duration, omit } from '@salesforce/kit';
import { Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages, SandboxEvents, SandboxInfo, SfError } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import requestFunctions, { readSandboxDefFile } from '../../../shared/sandboxRequest.js';
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
  'HistoryDays', // (int)
  'CopyChatter', // (boolean)
  'AutoActivate', // (boolean)
  'Description', // (string)
  'SourceId', // (string) SandboxInfoId as the source org used for a clone
  // 'ActivationUserGroupId', // Currently not supported but might be added in API v61.0
  // 'CopyArchivedActivities', -- only for full sandboxes; depends if a license was purchased
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
    'source-sandbox-name': Flags.string({
      summary: messages.getMessage('flags.source-sandbox-name.summary'),
      description: messages.getMessage('flags.source-sandbox-name.description'),
      exclusive: ['source-id'],
    }),
    'source-id': Flags.salesforceId({
      summary: messages.getMessage('flags.source-id.summary'),
      description: messages.getMessage('flags.source-id.description'),
      exclusive: ['source-sandbox-name'],
      length: 'both',
      char: undefined,
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
    this.registerLifecycleListenersAndMSO(lifecycle, {
      mso: {
        refresh: true,
        title: 'Sandbox Refresh',
      },
      isAsync: this.flags['async'],
      prodOrg: this.prodOrg,
    });

    // remove uneditable fields before refresh
    const updateableSandboxInfo = omit(this.sbxConfig, uneditableFields);
    this.debug('Calling refresh with SandboxInfo: %s ', updateableSandboxInfo);
    this.initSandboxProcessData(this.sbxConfig);

    try {
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
    let srcId: string | undefined;

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

    if (defFileContent.SourceSandboxName) {
      srcId = await requestFunctions.getSrcIdByName(
        this.flags['target-org'].getConnection(),
        defFileContent.SourceSandboxName
      );
      delete defFileContent.SourceSandboxName;
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
      ...(this.flags['source-sandbox-name']
        ? {
            SourceId: await requestFunctions.getSrcIdByName(
              this.flags['target-org'].getConnection(),
              this.flags['source-sandbox-name']
            ),
          }
        : this.flags['source-id']
        ? { SourceId: this.flags['source-id'] }
        : {}),
      ...(apexId ? { ApexClassId: apexId } : {}),
      ...(groupId ? { ActivationUserGroupId: groupId } : {}),
      ...(srcId ? { SourceId: srcId } : {}),
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
