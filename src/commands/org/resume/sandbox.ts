/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
import * as Interfaces from '@oclif/core/lib/interfaces';
import { SandboxCommandBase } from '../../../shared/sandboxCommandBase';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-env', 'resume.sandbox');

type CmdFlags = {
  wait: Duration;
  name: string;
  'job-id': string;
  'target-org': Org;
  'use-most-recent': boolean;
};

export default class ResumeSandbox extends SandboxCommandBase<SandboxProcessObject> {
  public static summary = messages.getMessage('summary');
  public static description = messages.getMessage('description');
  public static examples = messages.getMessages('examples');

  public static flags: Interfaces.FlagInput<CmdFlags> = {
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
  public static readonly state = 'beta';
  protected readonly lifecycleEventNames = ['postorgcreate'];
  private flags: CmdFlags;

  public async run(): Promise<SandboxProcessObject> {
    this.sandboxRequestConfig = await this.getSandboxRequestConfig();
    this.flags = (await this.parse(ResumeSandbox)).flags;
    this.debug('Resume started with args %s ', this.flags);
    return this.resumeSandbox();
  }

  protected getCheckSandboxStatusParams(): string[] {
    return [this.latestSandboxProgressObj.Id, this.flags['target-org'].getUsername()];
  }

  private createResumeSandboxRequest(): ResumeSandboxRequest {
    if (this.flags['use-most-recent']) {
      const [, sandboxRequestData] = this.sandboxRequestConfig.getLatestEntry();
      if (sandboxRequestData) {
        return { SandboxName: sandboxRequestData.sandboxProcessObject?.SandboxName };
      }
    }
    // build resume sandbox request from data provided
    return {
      ...Object.assign({}, this.flags.name ? { SandboxName: this.flags.name } : {}),
      ...Object.assign({}, this.flags['job-id'] ? { SandboxProcessObjId: this.flags['job-id'] } : {}),
    };
  }

  private async resumeSandbox(): Promise<SandboxProcessObject> {
    this.sandboxRequestData = this.buildSandboxRequestCacheEntry();
    const prodOrgUsername: string = this.sandboxRequestData.prodOrgUsername;

    if (!this.sandboxRequestData.sandboxProcessObject.SandboxName) {
      if (!this.flags['name'] && !this.flags['job-id']) {
        throw messages.createError('error.NoSandboxNameOrJobId');
      }
    }
    this.prodOrg = await Org.create({ aliasOrUsername: prodOrgUsername });
    this.flags['target-org'] = this.prodOrg;
    const lifecycle = Lifecycle.getInstance();

    this.registerLifecycleListeners(lifecycle, {
      isAsync: false,
      alias: this.sandboxRequestData.alias,
      setDefault: this.sandboxRequestData.setDefault,
      prodOrg: this.prodOrg,
      tracksSource: this.sandboxRequestData.tracksSource,
    });

    if (
      await this.verifyIfAuthExists(
        this.prodOrg,
        this.sandboxRequestData.sandboxProcessObject.SandboxName,
        this.flags['job-id'],
        lifecycle
      )
    ) {
      return this.latestSandboxProgressObj;
    }

    const sandboxReq = this.createResumeSandboxRequest();

    if (this.flags.wait?.seconds > 0) {
      this.spinner.start('Resume Create');
    }

    this.debug('Calling create with ResumeSandboxRequest: %s ', sandboxReq);

    try {
      return await this.prodOrg.resumeSandbox(sandboxReq, {
        wait: this.flags.wait ?? Duration.seconds(0),
        interval: Duration.seconds(30),
      });
    } catch (err) {
      this.spinner.stop();
      const error = err as SfError;
      if (this.pollingTimeOut) {
        void lifecycle.emit(SandboxEvents.EVENT_ASYNC_RESULT, undefined);
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      } else if (error.name === 'SandboxCreateNotCompleteError') {
        process.exitCode = 68;
        return this.latestSandboxProgressObj;
      }
      throw err;
    }
  }

  private buildSandboxRequestCacheEntry(): SandboxRequestCacheEntry {
    let sandboxRequestCacheEntry = {
      alias: undefined,
      setDefault: undefined,
      prodOrgUsername: undefined,
      sandboxProcessObject: {},
      sandboxRequest: {},
      tracksSource: undefined,
    } as SandboxRequestCacheEntry;

    let name: string | undefined;
    let entry: SandboxRequestCacheEntry | undefined;

    if (this.flags['use-most-recent']) {
      [name, entry] = this.sandboxRequestConfig.getLatestEntry() || [undefined, undefined];
      if (!name) {
        throw messages.createError('error.LatestSandboxRequestNotFound');
      }
      sandboxRequestCacheEntry = entry;
    } else if (this.flags.name) {
      sandboxRequestCacheEntry = this.sandboxRequestConfig.get(this.flags.name) || sandboxRequestCacheEntry;
    } else if (this.flags['job-id']) {
      const sce: SandboxRequestCacheEntry = this.sandboxRequestConfig
        .entries()
        .find(
          ([, e]) => (e as SandboxRequestCacheEntry).sandboxProcessObject.Id === this.flags['job-id']
        )[1] as SandboxRequestCacheEntry;
      sandboxRequestCacheEntry = sce || sandboxRequestCacheEntry;
    }
    sandboxRequestCacheEntry.prodOrgUsername ??= this.flags['target-org']?.getUsername();
    sandboxRequestCacheEntry.sandboxProcessObject.SandboxName ??= this.flags.name;
    return sandboxRequestCacheEntry;
  }

  private async verifyIfAuthExists(
    prodOrg: Org,
    sandboxName: string,
    jobId: string,
    lifecycle: Lifecycle
  ): Promise<boolean> {
    const sandboxProcessObject: SandboxProcessObject = await getSandboxProcessObject(prodOrg, sandboxName, jobId);
    const sandboxUsername = `${prodOrg.getUsername()}.${sandboxProcessObject.SandboxName}`;
    const exists = await (await StateAggregator.getInstance()).orgs.exists(sandboxUsername);
    if (exists) {
      this.latestSandboxProgressObj = sandboxProcessObject;
      const resultEvent = {
        sandboxProcessObj: this.latestSandboxProgressObj,
        sandboxRes: { authUserName: sandboxUsername } as Partial<SandboxUserAuthResponse>,
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
  const where = sandboxName ? `SandboxName='${sandboxName}'` : `Id='${jobId}'`;
  const queryStr = `SELECT Id, Status, SandboxName, SandboxInfoId, LicenseType, CreatedDate, CopyProgress, SandboxOrganization, SourceId, Description, EndDate FROM SandboxProcess WHERE ${where} AND Status != 'D'`;
  try {
    return await prodOrg.getConnection().singleRecordQuery(queryStr, {
      tooling: true,
    });
  } catch (err) {
    throw messages.createError('error.NoSandboxRequestFound');
  }
};
