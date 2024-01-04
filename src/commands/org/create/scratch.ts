/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Messages,
  Lifecycle,
  ScratchOrgLifecycleEvent,
  scratchOrgLifecycleEventName,
  Org,
  scratchOrgCreate,
  SfError,
} from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { buildScratchOrgRequest } from '../../../shared/scratchOrgRequest.js';
import { buildStatus } from '../../../shared/scratchOrgOutput.js';
import { ScratchCreateResponse } from '../../../shared/orgTypes.js';
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create_scratch');

export const secretTimeout = 60000;

const definitionFileHelpGroupName = 'Definition File Override';
export default class EnvCreateScratch extends SfCommand<ScratchCreateResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['env:create:scratch'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    alias: Flags.string({
      char: 'a',
      summary: messages.getMessage('flags.alias.summary'),
      description: messages.getMessage('flags.alias.description'),
    }),
    async: Flags.boolean({
      summary: messages.getMessage('flags.async.summary'),
      description: messages.getMessage('flags.async.description'),
    }),
    'set-default': Flags.boolean({
      char: 'd',
      summary: messages.getMessage('flags.set-default.summary'),
    }),
    'definition-file': Flags.file({
      exists: true,
      char: 'f',
      summary: messages.getMessage('flags.definition-file.summary'),
      description: messages.getMessage('flags.definition-file.description'),
    }),
    'target-dev-hub': Flags.requiredHub({
      char: 'v',
      summary: messages.getMessage('flags.target-dev-hub.summary'),
      description: messages.getMessage('flags.target-dev-hub.description'),
      required: true,
    }),
    'no-ancestors': Flags.boolean({
      char: 'c',
      summary: messages.getMessage('flags.no-ancestors.summary'),
      helpGroup: 'Packaging',
    }),
    edition: Flags.string({
      char: 'e',
      summary: messages.getMessage('flags.edition.summary'),
      description: messages.getMessage('flags.edition.description'),
      options: [
        'developer',
        'enterprise',
        'group',
        'professional',
        'partner-developer',
        'partner-enterprise',
        'partner-group',
        'partner-professional',
      ],
      helpGroup: definitionFileHelpGroupName,
    }),
    'no-namespace': Flags.boolean({
      char: 'm',
      summary: messages.getMessage('flags.no-namespace.summary'),
      helpGroup: 'Packaging',
    }),
    'duration-days': Flags.duration({
      unit: 'days',
      default: Duration.days(7),
      min: 1,
      max: 30,
      char: 'y',
      helpValue: '<days>',
      summary: messages.getMessage('flags.duration-days.summary'),
    }),
    wait: Flags.duration({
      unit: 'minutes',
      default: Duration.minutes(5),
      min: 2,
      char: 'w',
      helpValue: '<minutes>',
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
    }),
    'api-version': Flags.orgApiVersion(),
    'client-id': Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.client-id.summary'),
    }),
    'track-source': Flags.boolean({
      default: true,
      char: 't',
      summary: messages.getMessage('flags.track-source.summary'),
      description: messages.getMessage('flags.track-source.description'),
      allowNo: true,
    }),
    username: Flags.string({
      summary: messages.getMessage('flags.username.summary'),
      description: messages.getMessage('flags.username.description'),
      helpGroup: definitionFileHelpGroupName,
    }),
    description: Flags.string({
      summary: messages.getMessage('flags.description.summary'),
      helpGroup: definitionFileHelpGroupName,
    }),
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      helpGroup: definitionFileHelpGroupName,
    }),
    release: Flags.string({
      summary: messages.getMessage('flags.release.summary'),
      description: messages.getMessage('flags.release.description'),
      options: ['preview', 'previous'],
      helpGroup: definitionFileHelpGroupName,
    }),
    'admin-email': Flags.string({
      summary: messages.getMessage('flags.admin-email.summary'),
      helpGroup: definitionFileHelpGroupName,
    }),
    'source-org': Flags.salesforceId({
      summary: messages.getMessage('flags.source-org.summary'),
      startsWith: '00D',
      length: 15,
      helpGroup: definitionFileHelpGroupName,
      // salesforceId flag has `i` and that would be a conflict with client-id
      char: undefined,
    }),
  };

  public async run(): Promise<ScratchCreateResponse> {
    const lifecycle = Lifecycle.getInstance();
    const { flags } = await this.parse(EnvCreateScratch);
    const baseUrl = flags['target-dev-hub'].getField(Org.Fields.INSTANCE_URL)?.toString();
    if (!baseUrl) {
      throw new SfError('No instance URL found for the dev hub');
    }

    const createCommandOptions = await buildScratchOrgRequest(
      flags,
      flags['client-id'] ? await this.secretPrompt({ message: messages.getMessage('prompt.secret') }) : undefined
    );
    let lastStatus: string | undefined;

    if (!flags.async) {
      lifecycle.on<ScratchOrgLifecycleEvent>(scratchOrgLifecycleEventName, async (data): Promise<void> => {
        lastStatus = buildStatus(data, baseUrl);
        this.spinner.status = lastStatus;
        return Promise.resolve();
      });
    }
    this.log();
    this.spinner.start(
      flags.async ? 'Requesting Scratch Org (will not wait for completion because --async)' : 'Creating Scratch Org'
    );

    try {
      const { username, scratchOrgInfo, authFields, warnings } = await scratchOrgCreate(createCommandOptions);

      this.spinner.stop(lastStatus);
      if (!scratchOrgInfo) {
        throw new SfError('The scratch org did not return with any information');
      }
      this.log();
      if (flags.async) {
        this.info(messages.getMessage('action.resume', [this.config.bin, scratchOrgInfo.Id]));
      } else {
        this.logSuccess(messages.getMessage('success'));
      }

      return { username, scratchOrgInfo, authFields, warnings, orgId: authFields?.orgId };
    } catch (error) {
      if (error instanceof SfError && error.name === 'ScratchOrgInfoTimeoutError') {
        this.spinner.stop(lastStatus);
        const scratchOrgInfoId = (error.data as { scratchOrgInfoId: string }).scratchOrgInfoId;
        const resumeMessage = messages.getMessage('action.resume', [this.config.bin, scratchOrgInfoId]);

        this.info(resumeMessage);
        this.error('The scratch org did not complete within your wait time', { code: '69', exit: 69 });
      } else {
        throw error;
      }
    }
  }
}
