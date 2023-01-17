/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { Duration } from '@salesforce/kit';
import {
  Messages,
  ScratchOrgCreateOptions,
  Lifecycle,
  ScratchOrgLifecycleEvent,
  scratchOrgLifecycleEventName,
  Org,
  scratchOrgCreate,
  SfError,
} from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { buildStatus } from '../../../shared/scratchOrgOutput';
import { ScratchCreateResponse } from '../../../types';
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-env', 'create_scratch');

export const secretTimeout = 60000;

export default class EnvCreateScratch extends SfCommand<ScratchCreateResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';

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
      exactlyOne: ['definition-file', 'edition'],
    }),
    'target-dev-hub': Flags.requiredHub({
      char: 'v',
      summary: messages.getMessage('flags.target-hub.summary'),
      description: messages.getMessage('flags.target-hub.description'),
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
      exactlyOne: ['definition-file', 'edition'],
    }),
    'no-namespace': Flags.boolean({
      char: 'm',
      summary: messages.getMessage('flags.no-namespace.summary'),
      helpGroup: 'Packaging',
    }),
    'duration-days': Flags.duration({
      unit: 'days',
      defaultValue: 7,
      min: 1,
      max: 30,
      char: 'y',
      helpValue: '<days>',
      summary: messages.getMessage('flags.duration-days.summary'),
    }),
    wait: Flags.duration({
      unit: 'minutes',
      defaultValue: 5,
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
  };
  public async run(): Promise<ScratchCreateResponse> {
    const lifecycle = Lifecycle.getInstance();
    const { flags } = await this.parse(EnvCreateScratch);
    const baseUrl = flags['target-dev-hub'].getField(Org.Fields.INSTANCE_URL).toString();
    const orgConfig = flags['definition-file']
      ? (JSON.parse(await fs.promises.readFile(flags['definition-file'], 'utf-8')) as Record<string, unknown>)
      : { edition: flags.edition };

    const createCommandOptions: ScratchOrgCreateOptions = {
      hubOrg: flags['target-dev-hub'],
      clientSecret: flags['client-id'] ? await this.clientSecretPrompt() : undefined,
      connectedAppConsumerKey: flags['client-id'],
      durationDays: flags['duration-days'].days,
      nonamespace: flags['no-namespace'],
      noancestors: flags['no-ancestors'],
      wait: flags.async ? Duration.minutes(0) : flags.wait,
      apiversion: flags['api-version'],
      orgConfig,
      alias: flags.alias,
      setDefault: flags['set-default'],
      tracksSource: flags['track-source'],
    };

    let lastStatus: string;

    if (!flags.async) {
      // eslint-disable-next-line @typescript-eslint/require-await
      lifecycle.on<ScratchOrgLifecycleEvent>(scratchOrgLifecycleEventName, async (data): Promise<void> => {
        lastStatus = buildStatus(data, baseUrl);
        this.spinner.status = lastStatus;
      });
    }
    this.log();
    this.spinner.start(
      flags.async ? 'Requesting Scratch Org (will not wait for completion because --async)' : 'Creating Scratch Org'
    );

    try {
      const { username, scratchOrgInfo, authFields, warnings } = await scratchOrgCreate(createCommandOptions);

      this.spinner.stop(lastStatus);
      this.log();
      if (flags.async) {
        this.info(messages.getMessage('action.resume', [scratchOrgInfo.Id]));
      } else {
        this.logSuccess(messages.getMessage('success'));
      }

      return { username, scratchOrgInfo, authFields, warnings, orgId: scratchOrgInfo.Id };
    } catch (error) {
      if (error instanceof SfError && error.name === 'ScratchOrgInfoTimeoutError') {
        this.spinner.stop(lastStatus);
        const scratchOrgInfoId = (error.data as { scratchOrgInfoId: string }).scratchOrgInfoId;
        const resumeMessage = messages.getMessage('action.resume', [scratchOrgInfoId]);

        this.info(resumeMessage);
        this.error('The scratch org did not complete within your wait time', { code: '69', exit: 69 });
      } else {
        throw error;
      }
    }
  }

  private async clientSecretPrompt(): Promise<string> {
    const { secret } = await this.timedPrompt<{ secret: string }>(
      [
        {
          name: 'secret',
          message: messages.getMessage('prompt.secret'),
          type: 'password',
        },
      ],
      secretTimeout
    );
    return secret;
  }
}
