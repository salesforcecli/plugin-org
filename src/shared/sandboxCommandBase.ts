/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import os from 'node:os';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Config } from '@oclif/core';
import {
  AuthInfo,
  Lifecycle,
  Messages,
  Org,
  ResultEvent,
  SandboxEvents,
  SandboxProcessObject,
  SandboxRequestCache,
  SandboxRequestCacheEntry,
  SandboxUserAuthResponse,
  StatusEvent,
} from '@salesforce/core';
import { SandboxStages } from './sandboxStages.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'sandboxbase');

export type SandboxCommandResponse = SandboxProcessObject & {
  SandboxUsername?: string;
};

export abstract class SandboxCommandBase<T> extends SfCommand<T> {
  protected stages!: SandboxStages;
  protected latestSandboxProgressObj?: SandboxProcessObject;
  protected sandboxAuth?: SandboxUserAuthResponse;
  protected prodOrg?: Org;
  protected pollingTimeOut = false;
  // initialized at top of run method
  protected sandboxRequestConfig!: SandboxRequestCache;
  protected sandboxRequestData: SandboxRequestCacheEntry | undefined;
  protected action: 'Create' | 'Refresh' | 'Create/Refresh';
  protected sandboxUsername?: string;
  public constructor(argv: string[], config: Config) {
    super(argv, config);
    this.action =
      this.constructor.name === 'RefreshSandbox'
        ? 'Refresh'
        : ['CreateSandbox', 'ResumeSandbox'].includes(this.constructor.name)
        ? 'Create'
        : 'Create/Refresh';
  }
  protected async getSandboxRequestConfig(): Promise<SandboxRequestCache> {
    if (!this.sandboxRequestConfig) {
      this.sandboxRequestConfig = await SandboxRequestCache.create();
    }
    return this.sandboxRequestConfig;
  }

  protected async calculateTrackingSetting(tracking = true): Promise<boolean> {
    // sandbox types that don't support tracking
    if (
      this.sandboxRequestData?.sandboxRequest.LicenseType &&
      ['Partial', 'Full'].includes(this.sandboxRequestData.sandboxRequest.LicenseType)
    ) {
      return false;
    }
    // returns false for a sandbox type that supports it but user has opted out
    if (tracking === false) {
      return false;
    }
    // on a resume, we might not have a prod org...it's optional?
    if (this.prodOrg) {
      // if user hasn't opted out of tracking, and sandbox type supports it, verify that prod org supports tracking-enabled sandboxes
      const sourceTrackingSettings = await this.prodOrg
        .getConnection()
        .singleRecordQuery('SELECT IsSourceTrackingSandboxesEnabled FROM SourceTrackingSettings', { tooling: true });
      if (sourceTrackingSettings?.IsSourceTrackingSandboxesEnabled !== true) {
        return false;
      }
    }
    // default for Dev/DevPro when prod org has feature enabled for sandboxes
    return true;
  }

  protected registerLifecycleListenersAndMSO(
    lifecycle: Lifecycle,
    options: {
      mso: { title: string; refresh?: boolean };
      isAsync: boolean;
      alias?: string;
      setDefault?: boolean;
      prodOrg?: Org;
      tracksSource?: boolean;
    }
  ): void {
    this.stages = new SandboxStages({
      refresh: options.mso.refresh ?? false,
      jsonEnabled: this.jsonEnabled(),
      title: options.isAsync ? `${options.mso.title} (async)` : options.mso.title,
    });

    this.stages.start();

    lifecycle.on('POLLING_TIME_OUT', async () => {
      this.pollingTimeOut = true;
      this.stages.stop();
      return Promise.resolve(this.updateSandboxRequestData());
    });

    lifecycle.on(SandboxEvents.EVENT_RESUME, async (results: SandboxProcessObject) => {
      this.stages.start();
      this.latestSandboxProgressObj = results;
      this.stages.update(this.latestSandboxProgressObj);

      return Promise.resolve(this.updateSandboxRequestData());
    });

    lifecycle.on(SandboxEvents.EVENT_ASYNC_RESULT, async (results: SandboxProcessObject | undefined) => {
      // this event is fired by commands on poll timeout without any payload,
      // we want to make sure to only update state if there's payload (event from sfdx-core).
      if (results) {
        this.latestSandboxProgressObj = results;
        this.stages.update(this.latestSandboxProgressObj);
        this.updateSandboxRequestData();
      }

      this.stages.stop('async');
      if (this.pollingTimeOut) {
        this.warn(messages.getMessage('warning.ClientTimeoutWaitingForSandboxProcess', [this.action.toLowerCase()]));
      }
      return Promise.resolve(this.info(messages.getMessage('checkSandboxStatus', this.getCheckSandboxStatusParams())));
    });

    lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) => {
      // this starts MSO for:
      // * org create/create sandbox
      this.stages.start();
      this.latestSandboxProgressObj = results.sandboxProcessObj;
      this.updateSandboxRequestData();

      this.stages.update(this.latestSandboxProgressObj);

      return Promise.resolve();
    });

    lifecycle.on(SandboxEvents.EVENT_AUTH, async (results: SandboxUserAuthResponse) => {
      this.sandboxUsername = results.authUserName;
      this.stages.auth();
      this.sandboxAuth = results;
      return Promise.resolve();
    });

    lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
      this.latestSandboxProgressObj = results.sandboxProcessObj;
      this.sandboxUsername = results.sandboxRes.authUserName;
      this.updateSandboxRequestData();

      this.stages.update(results.sandboxProcessObj);

      if (results.sandboxRes?.authUserName) {
        const authInfo = await AuthInfo.create({ username: results.sandboxRes?.authUserName });
        await authInfo.handleAliasAndDefaultSettings({
          alias: options.alias,
          setDefault: options.setDefault ?? false,
          setDefaultDevHub: false,
          setTracksSource: await this.calculateTrackingSetting(options.tracksSource),
        });
      }
      this.stages.stop();

      this.removeSandboxProgressConfig();
      this.reportResults(results);
    });

    lifecycle.on(SandboxEvents.EVENT_MULTIPLE_SBX_PROCESSES, async (results: SandboxProcessObject[]) => {
      const [resumingProcess, ...otherSbxProcesses] = results;
      const sbxProcessIds = otherSbxProcesses.map((sbxProcess) => sbxProcess.Id);
      const sbxProcessStatuses = otherSbxProcesses.map((sbxProcess) => sbxProcess.Status);

      this.warn(
        messages.getMessage('warning.MultipleMatchingSandboxProcesses', [
          otherSbxProcesses[0].SandboxName,
          sbxProcessIds.toString(),
          sbxProcessStatuses.toString(),
          resumingProcess.Id,
          sbxProcessIds[0],
          this.prodOrg?.getUsername(),
        ])
      );
      return Promise.resolve();
    });
  }

  protected reportResults(results: ResultEvent): void {
    this.logSuccess(
      [
        messages.getMessage('sandboxSuccess'),
        messages.getMessages('sandboxSuccess.actions', [this.config.bin, results.sandboxRes?.authUserName]),
      ].join(os.EOL)
    );
  }

  protected updateSandboxRequestData(): void {
    if (this.sandboxRequestData && this.latestSandboxProgressObj) {
      this.sandboxRequestData.sandboxProcessObject = this.latestSandboxProgressObj;
    }
    this.saveSandboxProgressConfig();
  }

  protected saveSandboxProgressConfig(): void {
    if (this.sandboxRequestData?.sandboxProcessObject.SandboxName && this.sandboxRequestData) {
      this.sandboxRequestConfig.set(this.sandboxRequestData.sandboxProcessObject.SandboxName, this.sandboxRequestData);
      this.sandboxRequestConfig.writeSync();
    }
  }

  // Gets the SandboxName either from the request data or the SandboxProcessObject
  protected getSandboxName(): string | undefined {
    return this.sandboxRequestData?.sandboxProcessObject.SandboxName ?? this.latestSandboxProgressObj?.SandboxName;
  }

  // Not sure why the lint rule is complaining since it's definitely called.
  // eslint-disable-next-line class-methods-use-this
  protected getSandboxUsername(prodOrgUsername: string, sandboxName: string): string {
    return `${prodOrgUsername}.${sandboxName}`;
  }

  // Adds the sandbox username to the command JSON if we know it.
  protected getSandboxCommandResponse(): SandboxCommandResponse {
    let sbxUsername;
    if (this.sandboxUsername) {
      sbxUsername = this.sandboxUsername;
    } else {
      const prodOrgUsername = this.prodOrg?.getUsername();
      const sandboxName = this.getSandboxName();
      if (prodOrgUsername && sandboxName) {
        sbxUsername = this.getSandboxUsername(prodOrgUsername, sandboxName);
      }
    }
    return { ...(this.latestSandboxProgressObj as SandboxProcessObject), SandboxUsername: sbxUsername };
  }

  protected catch(error: Error): Promise<never> {
    if (this.stages) {
      this.stages.stop('failed');
    }

    return super.catch(error);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async finally(_: Error | undefined): Promise<any> {
    const lifecycle = Lifecycle.getInstance();
    lifecycle.removeAllListeners('POLLING_TIME_OUT');
    lifecycle.removeAllListeners(SandboxEvents.EVENT_RESUME);
    lifecycle.removeAllListeners(SandboxEvents.EVENT_ASYNC_RESULT);
    lifecycle.removeAllListeners(SandboxEvents.EVENT_STATUS);
    lifecycle.removeAllListeners(SandboxEvents.EVENT_AUTH);
    lifecycle.removeAllListeners(SandboxEvents.EVENT_RESULT);
    lifecycle.removeAllListeners(SandboxEvents.EVENT_MULTIPLE_SBX_PROCESSES);

    return super.finally(_);
  }

  private removeSandboxProgressConfig(): void {
    if (this.latestSandboxProgressObj?.SandboxName) {
      this.sandboxRequestConfig.unset(this.latestSandboxProgressObj.SandboxName);
      this.sandboxRequestConfig.writeSync();
    }
  }

  protected abstract getCheckSandboxStatusParams(): string[];
}
