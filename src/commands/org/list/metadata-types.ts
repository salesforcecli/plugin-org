/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';

import { Messages } from '@salesforce/core';
import type { DescribeMetadataResult } from '@jsforce/jsforce-node/lib/api/metadata.js';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { Flags, loglevel, requiredOrgFlagWithDeprecations, SfCommand } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'metadata-types');

export class ListMetadataTypes extends SfCommand<DescribeMetadataResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:mdapi:describemetadata'];
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
      description: messages.getMessage('flags.output-file.description'),
    }),
    'filter-known': Flags.boolean({
      aliases: ['filterknown'],
      deprecateAliases: true,
      char: 'k',
      summary: messages.getMessage('flags.filter-known.summary'),
      hidden: true,
    }),
  };

  public async run(): Promise<DescribeMetadataResult> {
    const { flags } = await this.parse(ListMetadataTypes);
    const connection = flags['target-org'].getConnection(flags['api-version']);
    const describeResult = await connection.metadata.describe(flags['api-version']);

    if (flags['filter-known']) {
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

    if (flags['output-file']) {
      await fs.promises.writeFile(flags['output-file'], JSON.stringify(describeResult, null, 2));
      this.logSuccess(`Wrote result file to ${flags['output-file']}.`);
    } else {
      this.table({
        data: describeResult.metadataObjects.map((md) => ({
          'Xml Names': md.xmlName,
          'Child Xml Names': md.childXmlNames.length ? `[ ${md.childXmlNames.join('\n')} ]` : '',
          'Directory Name': md.directoryName,
          'In Folder': md.inFolder,
          'Meta File': md.metaFile,
          suffix: md.suffix,
        })),
        title: 'Metadata',
        overflow: 'wrap',
        sort: {
          'Xml Names': 'asc',
        },
      });
      this.log(`Organizational Namespace: ${describeResult.organizationNamespace}`);
      this.log(`Partial Save Allowed: ${describeResult.partialSaveAllowed}`);
      this.log(`Test Required: ${describeResult.testRequired}`);
    }
    return describeResult;
  }
}
