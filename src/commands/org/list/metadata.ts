/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';


import { Messages } from '@salesforce/core';
import type { FileProperties, ListMetadataQuery } from 'jsforce/api/metadata';
import { Flags, loglevel, requiredOrgFlagWithDeprecations, SfCommand } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
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
      this.styledJSON(listResult);
    } else {
      this.warn(messages.getMessage('noMatchingMetadata', [flags['metadata-type'], conn.getUsername()]));
    }

    return listResult;
  }
}
