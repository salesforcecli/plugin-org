/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { Messages } from '@salesforce/core';
import { FileProperties, ListMetadataQuery } from 'jsforce/api/metadata';
import { Flags, loglevel, requiredOrgFlagWithDeprecations, SfCommand } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'list.metadata');

export type ListMetadataCommandResult = FileProperties[];

export class ListMetadata extends SfCommand<ListMetadataCommandResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:mdapi:listmetadata'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    'api-version': Flags.orgApiVersion({
      aliases: ['apiversion'],
      deprecateAliases: true,
      char: 'a',
      summary: messages.getMessage('flags.api-version'),
    }),
    loglevel,
    'target-org': requiredOrgFlagWithDeprecations,
    'output-file': Flags.file({
      aliases: ['resultfile'],
      deprecateAliases: true,
      char: 'f',
      summary: messages.getMessage('flags.output-file'),
    }),
    'metadata-type': Flags.string({
      aliases: ['metadatatype'],
      deprecateAliases: true,
      char: 'm',
      summary: messages.getMessage('flags.metadatatype'),
      description: messages.getMessage('flagsLong.metadatatype'),
      required: true,
    }),
    folder: Flags.string({
      summary: messages.getMessage('flags.folder'),
      description: messages.getMessage('flagsLong.folder'),
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
      this.log(messages.getMessage('noMatchingMetadata', [flags['metadata-type'], conn.getUsername()]));
    }

    return listResult;
  }
}
