/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { Messages } from '@salesforce/core';
import { DescribeMetadataResult } from 'jsforce/api/metadata';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import {
  Flags,
  loglevel,
  orgApiVersionFlagWithDeprecations,
  requiredOrgFlagWithDeprecations,
  SfCommand,
} from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'metadata-types');

export class DescribeMetadata extends SfCommand<DescribeMetadataResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'api-version': orgApiVersionFlagWithDeprecations,
    loglevel,
    'target-org': requiredOrgFlagWithDeprecations,
    resultfile: Flags.file({
      char: 'f',
      description: messages.getMessage('flags.resultfile'),
      summary: messages.getMessage('flagsLong.resultfile'),
    }),
    filterknown: Flags.boolean({
      char: 'k',
      description: messages.getMessage('flags.filterknown'),
      summary: messages.getMessage('flagsLong.filterknown'),
      hidden: true,
    }),
  };

  public async run(): Promise<DescribeMetadataResult> {
    const { flags } = await this.parse(DescribeMetadata);
    const connection = flags['target-org'].getConnection(flags['api-version']);
    const describeResult = await connection.metadata.describe(flags['api-version']);

    if (flags.filterknown) {
      this.debug('Filtering for only metadata types unregistered in the CLI');
      const registry = new RegistryAccess();
      describeResult.metadataObjects = describeResult.metadataObjects.filter((md) => {
        try {
          // An error is thrown when a type can't be found by name, and we want
          // the ones that can't be found.
          registry.getTypeByName(md.xmlName);
          return false;
        } catch (e) {
          return true;
        }
      });
    }

    if (flags.resultfile) {
      fs.writeFileSync(flags.resultfile, JSON.stringify(describeResult, null, 2));
      this.log(`Wrote result file to ${flags.resultfile}.`);
    } else if (!this.jsonEnabled()) {
      this.styledJSON(describeResult);
    }
    return describeResult;
  }
}
