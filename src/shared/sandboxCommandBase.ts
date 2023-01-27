/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
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
import { SandboxProgress, SandboxStatusData } from './sandboxProgress';
import { State } from './stagedProgress';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'sandboxbase');
export abstract class SandboxCommandBase<T> extends SfCommand<T> {
  protected sandboxProgress: SandboxProgress;
  protected latestSandboxProgressObj?: SandboxProcessObject;
  protected sandboxAuth?: SandboxUserAuthResponse;
  protected prodOrg?: Org;
  protected pollingTimeOut = false;
  // initialized at top of run method
  protected sandboxRequestConfig!: SandboxRequestCache;
  protected sandboxRequestData: SandboxRequestCacheEntry | undefined;
  public constructor(argv: string[], config: Config) {
    super(argv, config);
    this.sandboxProgress = new SandboxProgress();
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
        .metadata.read('SourceTrackingSettings', 'SourceTrackingSettings');
      if (sourceTrackingSettings.enableSourceTrackingSandboxes !== true) {
        return false;
      }
    }
    // default for Dev/DevPro when prod org has feature enabled for sandboxes
    return true;
  }

  protected registerLifecycleListeners(
    lifecycle: Lifecycle,
    options: { isAsync: boolean; alias?: string; setDefault: boolean; prodOrg?: Org; tracksSource?: boolean }
  ): void {
    lifecycle.on('POLLING_TIME_OUT', async () => {
      this.pollingTimeOut = true;
      return Promise.resolve(this.updateSandboxRequestData());
    });

    lifecycle.on(SandboxEvents.EVENT_RESUME, async (results: SandboxProcessObject) => {
      this.latestSandboxProgressObj = results;
      this.sandboxProgress.markPreviousStagesAsCompleted(
        results.Status !== 'Completed' ? results.Status : 'Authenticating'
      );
      return Promise.resolve(this.updateSandboxRequestData());
    });

    lifecycle.on(SandboxEvents.EVENT_ASYNC_RESULT, async (results?: SandboxProcessObject) => {
      this.latestSandboxProgressObj = results ?? this.latestSandboxProgressObj;
      this.updateSandboxRequestData();
      if (!options.isAsync) {
        this.spinner.stop();
      }
      // things that require data on latestSandboxProgressObj
      if (this.latestSandboxProgressObj) {
        const progress = this.sandboxProgress.getSandboxProgress({
          sandboxProcessObj: this.latestSandboxProgressObj,
          sandboxRes: undefined,
        });
        const currentStage = progress.status;
        this.sandboxProgress.markPreviousStagesAsCompleted(currentStage);
        this.updateStage(currentStage, 'inProgress');
        this.updateProgress(
          { sandboxProcessObj: this.latestSandboxProgressObj, sandboxRes: undefined },
          options.isAsync
        );
      }
      if (this.pollingTimeOut) {
        this.warn(messages.getMessage('warning.ClientTimeoutWaitingForSandboxCreate'));
      }
      this.log(this.sandboxProgress.formatProgressStatus(false));
      return Promise.resolve(this.info(messages.getMessage('checkSandboxStatus', this.getCheckSandboxStatusParams())));
    });

    lifecycle.on(SandboxEvents.EVENT_STATUS, async (results: StatusEvent) => {
      this.latestSandboxProgressObj = results.sandboxProcessObj;
      this.updateSandboxRequestData();
      const progress = this.sandboxProgress.getSandboxProgress(results);
      const currentStage = progress.status;
      this.updateStage(currentStage, 'inProgress');
      return Promise.resolve(this.updateProgress(results, options.isAsync));
    });

    lifecycle.on(SandboxEvents.EVENT_AUTH, async (results: SandboxUserAuthResponse) => {
      this.sandboxAuth = results;
      return Promise.resolve();
    });

    lifecycle.on(SandboxEvents.EVENT_RESULT, async (results: ResultEvent) => {
      this.latestSandboxProgressObj = results.sandboxProcessObj;
      this.updateSandboxRequestData();
      this.sandboxProgress.markPreviousStagesAsCompleted();
      this.updateProgress(results, options.isAsync);
      if (!options.isAsync) {
        this.progress.stop();
      }
      if (results.sandboxRes?.authUserName) {
        const authInfo = await AuthInfo.create({ username: results.sandboxRes?.authUserName });
        await authInfo.handleAliasAndDefaultSettings({
          alias: options.alias,
          setDefault: options.setDefault,
          setDefaultDevHub: false,
          setTracksSource: await this.calculateTrackingSetting(options.tracksSource),
        });
      }
      this.removeSandboxProgressConfig();
      this.updateProgress(results, options.isAsync);
      this.reportResults(results);
    });
  }

  protected reportResults(results: ResultEvent): void {
    this.log();
    this.styledHeader('Sandbox Org Creation Status');
    this.log(this.sandboxProgress.formatProgressStatus(false));
    this.logSuccess(
      [
        messages.getMessage('sandboxSuccess'),
        messages.getMessages('sandboxSuccess.actions', [
          this.config.bin,
          results.sandboxRes?.authUserName,
          results.sandboxRes?.authUserName,
        ]),
      ].join(os.EOL)
    );
  }

  protected updateProgress(
    event: StatusEvent | (Omit<ResultEvent, 'sandboxRes'> & { sandboxRes?: ResultEvent['sandboxRes'] }),
    isAsync: boolean
  ): void {
    const sandboxProgress = this.sandboxProgress.getSandboxProgress(event);
    const sandboxData = {
      sandboxUsername: (event as ResultEvent).sandboxRes?.authUserName,
      sandboxProgress,
      sandboxProcessObj: event.sandboxProcessObj,
    } as SandboxStatusData;
    this.sandboxProgress.statusData = sandboxData;
    if (!isAsync) {
      this.spinner.status = this.sandboxProgress.formatProgressStatus();
    }
  }

  protected updateStage(stage: string | undefined, state: State): void {
    if (stage) {
      this.sandboxProgress.transitionStages(stage, state);
    }
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

  private removeSandboxProgressConfig(): void {
    if (this.latestSandboxProgressObj?.SandboxName) {
      this.sandboxRequestConfig.unset(this.latestSandboxProgressObj.SandboxName);
      this.sandboxRequestConfig.writeSync();
    }
  }

  protected abstract getCheckSandboxStatusParams(): string[];
}
