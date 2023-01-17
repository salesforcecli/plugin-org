/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import {
  Messages,
  scratchOrgResume,
  ScratchOrgCache,
  Lifecycle,
  ScratchOrgLifecycleEvent,
  scratchOrgLifecycleEventName,
} from '@salesforce/core';
import { ScratchCreateResponse } from '../../../types';
import { buildStatus } from '../../../shared/scratchOrgOutput';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-env', 'resume_scratch');

export default class EnvResumeScratch extends SfCommand<ScratchCreateResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'job-id': Flags.salesforceId({
      char: 'i',
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
    const { flags } = await this.parse(EnvResumeScratch);
    const cache = await ScratchOrgCache.create();
    const lifecycle = Lifecycle.getInstance();

    const jobId = flags['use-most-recent'] ? cache.getLatestKey() : flags['job-id'];
    if (!jobId && flags['use-most-recent']) throw messages.createError('error.NoRecentJobId');

    const { hubBaseUrl } = cache.get(jobId);
    let lastStatus: string;

    // eslint-disable-next-line @typescript-eslint/require-await
    lifecycle.on<ScratchOrgLifecycleEvent>(scratchOrgLifecycleEventName, async (data): Promise<void> => {
      lastStatus = buildStatus(data, hubBaseUrl);
      this.spinner.status = lastStatus;
    });

    this.log();
    this.spinner.start('Creating Scratch Org');

    const { username, scratchOrgInfo, authFields, warnings } = await scratchOrgResume(jobId);
    this.spinner.stop(lastStatus);

    this.log();
    this.logSuccess(messages.getMessage('success'));
    return { username, scratchOrgInfo, authFields, warnings, orgId: scratchOrgInfo.Id };
  }
}
