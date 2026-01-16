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

import {
  Flags,
  loglevel,
  orgApiVersionFlagWithDeprecations,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { MetadataResolver } from '@salesforce/source-deploy-retrieve';
import { OrgOpenCommandBase } from '../../shared/orgOpenCommandBase.js';
import { type OrgOpenOutput } from '../../shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');

export class OrgOpenCommand extends OrgOpenCommandBase<OrgOpenOutput> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:org:open', 'force:source:open'];
  public static deprecateAliases = true;

  public static readonly flags = {
    ...OrgOpenCommandBase.flags,
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': orgApiVersionFlagWithDeprecations,
    private: Flags.boolean({
      summary: messages.getMessage('flags.private.summary'),
      exclusive: ['url-only', 'browser'],
    }),
    browser: Flags.option({
      char: 'b',
      summary: messages.getMessage('flags.browser.summary'),
      options: ['chrome', 'edge', 'firefox'] as const, // These are ones supported by "open" package
      exclusive: ['url-only', 'private'],
    })(),
    path: Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.path.summary'),
      env: 'FORCE_OPEN_URL',
      exclusive: ['source-file'],
    }),
    'url-only': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.url-only.summary'),
      aliases: ['urlonly'],
      deprecateAliases: true,
    }),
    loglevel,
    'source-file': Flags.file({
      char: 'f',
      aliases: ['sourcefile'],
      exclusive: ['path'],
      deprecateAliases: true,
      summary: messages.getMessage('flags.source-file.summary'),
    }),
  };

  public async run(): Promise<OrgOpenOutput> {
    const { flags } = await this.parse(OrgOpenCommand);
    this.org = flags['target-org'];
    this.connection = this.org.getConnection(flags['api-version']);

    // `org.getMetadataUIURL` already generates a Frontdoor URL
    if (flags['source-file']) {
      return this.openOrgUI(flags, await generateFileUrl(flags['source-file'], this.org));
    }

    return this.openOrgUI(flags, await this.org.getFrontDoorUrl(flags.path));
  }
}

async function generateFileUrl(file: string, org: Org): Promise<string> {
  try {
    const metadataResolver = new MetadataResolver();
    const components = metadataResolver.getComponentsFromPath(file);
    const typeName = components[0]?.type?.name;

    if (!typeName) {
      throw new Error(`Unable to determine metadata type for file: ${file}`);
    }

    return await org.getMetadataUIURL(typeName, file);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('FlowIdNotFound') ||
        error.message.includes('CustomObjectIdNotFound') ||
        error.message.includes('ApexClassIdNotFound'))
    ) {
      throw error;
    }
    // fall back to generic frontdoor URL
    return org.getFrontDoorUrl();
  }
}
