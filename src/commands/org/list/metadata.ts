/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { Messages } from '@salesforce/core';
import { FileProperties, ListMetadataQuery } from 'jsforce/api/metadata';
import {
  Flags,
  loglevel,
  orgApiVersionFlagWithDeprecations,
  requiredOrgFlagWithDeprecations,
  SfCommand,
} from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'list.metadata');

export type ListMetadataCommandResult = FileProperties[];

export class ListMetadata extends SfCommand<ListMetadataCommandResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'api-version': orgApiVersionFlagWithDeprecations,
    loglevel,
    'target-org': requiredOrgFlagWithDeprecations,
    resultfile: Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.resultfile'),
    }),
    type: Flags.string({
      char: 'm',
      aliases: ['metadatatype'],
      deprecateAliases: true,
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

    const query: ListMetadataQuery = flags.folder ? { type: flags.type, folder: flags.folder } : { type: flags.type };
    const listResult = await conn.metadata.list(query, flags['api-version']);

    if (flags.resultfile) {
      fs.writeFileSync(flags.resultfile, JSON.stringify(listResult, null, 2));
      this.log(`Wrote result file to ${flags.resultfile}.`);
    } else if (!this.jsonEnabled()) {
      if (listResult?.length) {
        this.styledJSON(listResult);
      } else {
        this.log(messages.getMessage('noMatchingMetadata', [flags.metadatatype, conn.getUsername()]));
      }
    }

    return listResult;
  }
}
