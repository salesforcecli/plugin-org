/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'node:os';
import { Flags } from '@salesforce/sf-plugins-core';
import {
  StateAggregator,
  Lifecycle,
  Messages,
  Org,
  ResultEvent,
  SandboxEvents,
  SandboxProcessObject,
  SandboxRequestCacheEntry,
  ResumeSandboxRequest,
  SandboxUserAuthResponse,
  SfError,
} from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import { SandboxCommandBase, SandboxCommandResponse } from '../../../shared/sandboxCommandBase.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'resume.sandbox');

export default class ResumeSandbox extends SandboxCommandBase<SandboxCommandResponse> {
  public static summary = messages.getMessage('summary');
  public static description = messages.getMessage('description');
  public static examples = messages.getMessages('examples');
  public static readonly aliases = ['env:resume:sandbox'];
  public static readonly deprecateAliases = true;
  public static flags = {
    wait: Flags.duration({
      char: 'w',
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
      min: 0,
      unit: 'minutes',
      helpValue: '<minutes>',
      defaultValue: 0,
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
      exclusive: ['job-id'],
    }),
    'job-id': Flags.salesforceId({
      startsWith: '0GR',
      char: 'i',
      summary: messages.getMessage('flags.id.summary'),
      description: messages.getMessage('flags.id.description'),
      exclusive: ['name'],
    }),
    'use-most-recent': Flags.boolean({
      char: 'l',
      summary: messages.getMessage('flags.use-most-recent.summary'),
    }),
    'target-org': Flags.optionalOrg({
      char: 'o',
      summary: messages.getMessage('flags.targetOrg.summary'),
      description: messages.getMessage('flags.targetOrg.description'),
    }),
  };
  private flags!: Interfaces.InferredFlags<typeof ResumeSandbox.flags>;

  public async run(): Promise<SandboxCommandResponse> {
    this.sandboxRequestConfig = await this.getSandboxRequestConfig();
    this.flags = (await this.parse(ResumeSandbox)).flags;
    this.debug('Resume started with args %s ', this.flags);
    return this.resumeSandbox();
  }

  protected getCheckSandboxStatusParams(): string[] {
    return [
      this.config.bin,
      ...(this.latestSandboxProgressObj ? [this.latestSandboxProgressObj.Id] : []),
      ...(this.flags['target-org']?.getUsername() ? [this.flags['target-org'].getUsername() as string] : []),
    ];
  }

  private createResumeSandboxRequest(): ResumeSandboxRequest {
    if (this.flags['use-most-recent'] && this.sandboxRequestConfig) {
      const latestEntry = this.sandboxRequestConfig.getLatestEntry();
      if (latestEntry) {
        const [, sandboxRequestData] = latestEntry;
        if (sandboxRequestData) {
          return { SandboxProcessObjId: sandboxRequestData.sandboxProcessObject?.Id };
        }
      }
    }
    // build resume sandbox request from data provided
    return {
      ...Object.assign({}, this.flags.name ? { SandboxName: this.flags.name } : {}),
      ...Object.assign({}, this.flags['job-id'] ? { SandboxProcessObjId: this.flags['job-id'] } : {}),
    };
  }

  private async resumeSandbox(): Promise<SandboxCommandResponse> {
    this.sandboxRequestData = this.buildSandboxRequestCacheEntry();
    const prodOrgUsername = this.sandboxRequestData.prodOrgUsername;

    if (!this.sandboxRequestData.sandboxProcessObject.SandboxName) {
      if (!this.flags['name'] && !this.flags['job-id']) {
        throw messages.createError('error.NoSandboxNameOrJobId');
      }
    }
    this.prodOrg = await Org.create({ aliasOrUsername: prodOrgUsername });
    this.flags['target-org'] = this.prodOrg;
    const lifecycle = Lifecycle.getInstance();

    this.registerLifecycleListenersAndMSO(lifecycle, {
      mso: {
        title: 'Resume Sandbox',
        refresh: this.sandboxRequestData.action === 'Refresh',
      },
      isAsync: false,
      alias: this.sandboxRequestData.alias,
      setDefault: this.sandboxRequestData.setDefault,
      prodOrg: this.prodOrg,
      tracksSource: this.sandboxRequestData.tracksSource,
    });

    if (
      this.latestSandboxProgressObj &&
      (await this.verifyIfAuthExists({
        prodOrg: this.prodOrg,
        sandboxName: this.sandboxRequestData.sandboxProcessObject.SandboxName,
        jobId: this.flags['job-id'] ?? this.sandboxRequestData.sandboxProcessObject.Id,
        lifecycle,
      }))
    ) {
      return this.getSandboxCommandResponse();
    }

    const sandboxReq = this.createResumeSandboxRequest();

    this.debug('Calling resume with ResumeSandboxRequest: %s ', sandboxReq);

    try {
      this.latestSandboxProgressObj = await this.prodOrg.resumeSandbox(sandboxReq, {
        wait: this.flags.wait ?? Duration.seconds(0),
        interval: Duration.seconds(30),
      });
      return this.getSandboxCommandResponse();
    } catch (err) {
      if (this.latestSandboxProgressObj && this.pollingTimeOut) {
        void lifecycle.emit(SandboxEvents.EVENT_ASYNC_RESULT, undefined);
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      } else if (
        this.latestSandboxProgressObj &&
        err instanceof SfError &&
        err.name === 'SandboxCreateNotCompleteError'
      ) {
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      }
      throw err;
    }
  }

  private buildSandboxRequestCacheEntry(): SandboxRequestCacheEntry {
    let sandboxRequestCacheEntry: SandboxRequestCacheEntry | undefined;

    if (this.sandboxRequestConfig && this.flags['use-most-recent']) {
      const latest = this.sandboxRequestConfig.getLatestEntry();
      const [name, entry] = latest ?? [undefined, undefined];
      if (!name) {
        throw messages.createError('error.LatestSandboxRequestNotFound');
      }
      sandboxRequestCacheEntry = entry;
    } else if (this.sandboxRequestConfig && this.flags.name) {
      sandboxRequestCacheEntry = this.sandboxRequestConfig.get(this.flags.name) || sandboxRequestCacheEntry;
    } else if (this.flags['job-id'] && this.sandboxRequestConfig) {
      const entries = this.sandboxRequestConfig.entries() as Array<[string, SandboxRequestCacheEntry]>;
      const sce = entries.find(([, e]) => e?.sandboxProcessObject?.Id === this.flags['job-id'])?.[1];
      sandboxRequestCacheEntry = sce;
      if (sandboxRequestCacheEntry === undefined) {
        this.warn(
          `Could not find a cache entry for ${this.flags['job-id']}.${EOL}If you are resuming a sandbox operation from a different machine note that we cannot set the alias/set-default flag values as those are saved locally.`
        );
      }
    }

    // If the action is in the cache entry, use it.
    if (sandboxRequestCacheEntry?.action) {
      this.action = sandboxRequestCacheEntry?.action;
    }

    return {
      ...(sandboxRequestCacheEntry ?? {
        sandboxProcessObject: { SandboxName: this.flags.name },
        sandboxRequest: {},
        setDefault: false,
      }),
      prodOrgUsername: sandboxRequestCacheEntry?.prodOrgUsername ?? (this.flags['target-org']?.getUsername() as string),
      action: sandboxRequestCacheEntry?.action ?? 'Create', // default to Create
    };
  }

  private async verifyIfAuthExists({
    prodOrg,
    sandboxName,
    jobId,
    lifecycle,
  }: {
    prodOrg: Org;
    sandboxName?: string;
    jobId?: string;
    lifecycle: Lifecycle;
  }): Promise<boolean> {
    const sandboxProcessObject: SandboxProcessObject = await getSandboxProcessObject(prodOrg, sandboxName, jobId);
    this.sandboxUsername = this.getSandboxUsername(prodOrg.getUsername() as string, sandboxProcessObject.SandboxName);
    const exists = await (await StateAggregator.getInstance()).orgs.exists(this.sandboxUsername);
    if (exists) {
      this.latestSandboxProgressObj = sandboxProcessObject;
      const resultEvent = {
        sandboxProcessObj: this.latestSandboxProgressObj,
        sandboxRes: { authUserName: this.sandboxUsername } as Partial<SandboxUserAuthResponse>,
      } as ResultEvent;
      await lifecycle.emit(SandboxEvents.EVENT_RESULT, resultEvent as Partial<ResultEvent>);
      return true;
    }
    return false;
  }
}

const getSandboxProcessObject = async (
  prodOrg: Org,
  sandboxName?: string,
  jobId?: string
): Promise<SandboxProcessObject> => {
  const where = getWhere(sandboxName, jobId);
  const queryStr = `SELECT Id, Status, SandboxName, SandboxInfoId, LicenseType, CreatedDate, CopyProgress, SandboxOrganization, SourceId, Description, EndDate FROM SandboxProcess WHERE ${where} AND Status != 'D'`;
  try {
    return await prodOrg.getConnection().singleRecordQuery(queryStr, {
      tooling: true,
    });
  } catch (err) {
    throw messages.createError('error.NoSandboxRequestFound');
  }
};

const getWhere = (sandboxName?: string, jobId?: string): string => {
  if (jobId) return `Id='${jobId}'`;
  if (sandboxName) return `SandboxName='${sandboxName}'`;
  throw new SfError('There must be a sandbox name or job id to query for the sandbox process object');
};
