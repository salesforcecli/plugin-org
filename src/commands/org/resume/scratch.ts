/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  Lifecycle,
  Messages,
  ScratchOrgCache,
  ScratchOrgLifecycleEvent,
  scratchOrgLifecycleEventName,
  scratchOrgLifecycleStages,
  scratchOrgResume,
  SfError,
} from '@salesforce/core';
import terminalLink from 'terminal-link';
import { ScratchCreateResponse } from '../../../shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'resume_scratch');

export default class OrgResumeScratch extends SfCommand<ScratchCreateResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['env:resume:scratch'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    'job-id': Flags.salesforceId({
      char: 'i',
      length: 'both',
      summary: messages.getMessage('flags.job-id.summary'),
      description: messages.getMessage('flags.job-id.description'),
      exactlyOne: ['use-most-recent', 'job-id'],
      startsWith: '2SR',
    }),
    'use-most-recent': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.use-most-recent.summary'),
      exactlyOne: ['use-most-recent', 'job-id'],
    }),
  };

  public async run(): Promise<ScratchCreateResponse> {
    const { flags } = await this.parse(OrgResumeScratch);
    const cache = await ScratchOrgCache.create();
    const lifecycle = Lifecycle.getInstance();

    const jobId = flags['use-most-recent'] ? cache.getLatestKey() : flags['job-id'];
    if (!jobId && flags['use-most-recent']) throw messages.createError('error.NoRecentJobId');

    // oclif doesn't know that the exactlyOne flag will ensure that one of these is set, and there we definitely have a jobID.
    assert(jobId);
    const cached = cache.get(jobId);
    const hubBaseUrl = cached?.hubBaseUrl;

    const stager = this.initStager<ScratchOrgLifecycleEvent & { alias: string | undefined }>({
      stages: scratchOrgLifecycleStages,
      title: 'Resuming Scratch Org',
      data: { alias: cached?.alias },
      postStagesBlock: [
        {
          label: 'Request Id',
          type: 'dynamic-key-value',
          get: (data) =>
            data?.scratchOrgInfo?.Id && terminalLink(data.scratchOrgInfo.Id, `${hubBaseUrl}/${data.scratchOrgInfo.Id}`),
          bold: true,
        },
        {
          label: 'OrgId',
          type: 'dynamic-key-value',
          get: (data) => data?.scratchOrgInfo?.ScratchOrg,
          bold: true,
          color: 'cyan',
        },
        {
          label: 'Username',
          type: 'dynamic-key-value',
          get: (data) => data?.scratchOrgInfo?.SignupUsername,
          bold: true,
          color: 'cyan',
        },
        {
          label: 'Alias',
          type: 'static-key-value',
          get: (data) => data?.alias,
        },
      ],
    });

    lifecycle.on<ScratchOrgLifecycleEvent>(scratchOrgLifecycleEventName, async (data): Promise<void> => {
      stager.goto(data.stage, data);
      if (data.stage === 'done') {
        stager.stop();
      }
      return Promise.resolve();
    });

    try {
      const { username, scratchOrgInfo, authFields, warnings } = await scratchOrgResume(jobId);
      this.log();
      this.logSuccess(messages.getMessage('success'));
      return { username, scratchOrgInfo, authFields, warnings, orgId: authFields?.orgId };
    } catch (e) {
      stager.stop(e as Error);

      if (cache.keys() && e instanceof Error && e.name === 'CacheMissError') {
        // we have something in the cache, but it didn't match what the user passed in
        throw messages.createError('error.jobIdMismatch', [jobId]);
      } else {
        throw SfError.wrap(e);
      }
    }
  }
}
