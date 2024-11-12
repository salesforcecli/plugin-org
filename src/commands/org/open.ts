/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import {
  Flags,
  loglevel,
  orgApiVersionFlagWithDeprecations,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import { MetadataResolver } from '@salesforce/source-deploy-retrieve';
import { buildFrontdoorUrl } from '../../shared/orgOpenUtils.js';
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
      parse: (input: string): Promise<string> => Promise.resolve(encodeURIComponent(decodeURIComponent(input))),
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

    const [frontDoorUrl, retUrl] = await Promise.all([
      buildFrontdoorUrl(this.org, this.connection),
      flags['source-file'] ? generateFileUrl(flags['source-file'], this.connection) : flags.path,
    ]);

    return this.openOrgUI(flags, frontDoorUrl, retUrl);
  }
}

const generateFileUrl = async (file: string, conn: Connection): Promise<string> => {
  try {
    const metadataResolver = new MetadataResolver();
    const components = metadataResolver.getComponentsFromPath(file);
    const typeName = components[0]?.type?.name;

    switch (typeName) {
      case 'Bot':
        return `AiCopilot/copilotStudio.app#/copilot/builder?copilotId=${await botFileNameToId(conn, file)}`;
      case 'ApexPage':
        return `/apex/${path.basename(file).replace('.page-meta.xml', '').replace('.page', '')}`;
      case 'Flow':
        return `/builder_platform_interaction/flowBuilder.app?flowId=${await flowFileNameToId(conn, file)}`;
      case 'FlexiPage':
        return `/visualEditor/appBuilder.app?pageId=${await flexiPageFilenameToId(conn, file)}`;
      default:
        return 'lightning/setup/FlexiPageList/home';
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'FlowIdNotFoundError') {
      throw error;
    }
    return 'lightning/setup/FlexiPageList/home';
  }
};

const botFileNameToId = async (conn: Connection, filePath: string): Promise<string> =>
  (
    await conn.singleRecordQuery<{ Id: string }>(
      `SELECT id FROM BotDefinition WHERE DeveloperName='${path.basename(filePath, '.bot-meta.xml')}'`
    )
  ).Id;

/** query flexipage via toolingPAI to get its ID (starts with 0M0) */
const flexiPageFilenameToId = async (conn: Connection, filePath: string): Promise<string> =>
  (
    await conn.singleRecordQuery<{ Id: string }>(
      `SELECT id FROM flexipage WHERE DeveloperName='${path.basename(filePath, '.flexipage-meta.xml')}'`,
      { tooling: true }
    )
  ).Id;

/** query the rest API to turn a flow's filepath into a FlowId  (starts with 301) */
const flowFileNameToId = async (conn: Connection, filePath: string): Promise<string> => {
  try {
    const flow = await conn.singleRecordQuery<{ DurableId: string }>(
      `SELECT DurableId FROM FlowVersionView WHERE FlowDefinitionView.ApiName = '${path.basename(
        filePath,
        '.flow-meta.xml'
      )}' ORDER BY VersionNumber DESC LIMIT 1`
    );
    return flow.DurableId;
  } catch (error) {
    throw messages.createError('FlowIdNotFound', [filePath]);
  }
};
