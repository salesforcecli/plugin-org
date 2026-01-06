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

import fs from 'node:fs';

import { Messages } from '@salesforce/core';
import type { FileProperties, ListMetadataQuery } from '@jsforce/jsforce-node/lib/api/metadata.js';
import { Flags, loglevel, requiredOrgFlagWithDeprecations, SfCommand } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'list.metadata');

export type ListMetadataCommandResult = FileProperties[];

export class ListMetadata extends SfCommand<ListMetadataCommandResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:mdapi:listmetadata'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    'api-version': Flags.orgApiVersion({
      aliases: ['apiversion', 'a'],
      deprecateAliases: true,
      summary: messages.getMessage('flags.api-version.summary'),
    }),
    loglevel,
    'target-org': requiredOrgFlagWithDeprecations,
    'output-file': Flags.file({
      aliases: ['resultfile'],
      deprecateAliases: true,
      char: 'f',
      summary: messages.getMessage('flags.output-file.summary'),
    }),
    'metadata-type': Flags.string({
      aliases: ['metadatatype'],
      deprecateAliases: true,
      char: 'm',
      summary: messages.getMessage('flags.metadata-type.summary'),
      required: true,
    }),
    folder: Flags.string({
      summary: messages.getMessage('flags.folder.summary'),
      description: messages.getMessage('flags.folder.description'),
    }),
  };

  public async run(): Promise<ListMetadataCommandResult> {
    const { flags } = await this.parse(ListMetadata);
    const conn = flags['target-org'].getConnection(flags['api-version']);

    const query: ListMetadataQuery = flags.folder
      ? { type: flags['metadata-type'], folder: flags.folder }
      : { type: flags['metadata-type'] };
    const listResult = await conn.metadata.list(query, flags['api-version']);

    if (flags['output-file']) {
      fs.writeFileSync(flags['output-file'], JSON.stringify(listResult, null, 2));
      this.logSuccess(`Wrote result file to ${flags['output-file']}.`);
    } else if (listResult?.length) {
      this.table({
        data: listResult.map((md) => ({
          'Created By': md.createdByName,
          'Created Date': md.createdDate.split('T')[0],
          'Full Name': md.fullName,
          Id: md.id,
          'Last Modified By': md.lastModifiedByName,
          'Last Modified': md.lastModifiedDate.split('T')[0],
          'Manageable State': md.manageableState,
          'Namespace Prefix': md.namespacePrefix,
        })),
        title: flags['metadata-type'],
        sort: {
          'Manageable State': 'asc',
        },
      });
    } else {
      this.warn(messages.getMessage('noMatchingMetadata', [flags['metadata-type'], conn.getUsername()]));
    }

    return listResult;
  }
}
