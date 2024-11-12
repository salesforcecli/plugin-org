/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import { buildFrontdoorUrl } from '../../../shared/orgOpenUtils.js';
import { OrgOpenCommandBase } from '../../../shared/orgOpenCommandBase.js';
import { type OrgOpenOutput } from '../../../shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open.agent');

export class OrgOpenAgent extends OrgOpenCommandBase<OrgOpenOutput> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    name: Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.name.summary'),
      required: true,
    }),
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
    'url-only': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.url-only.summary'),
      aliases: ['urlonly'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<OrgOpenOutput> {
    const { flags } = await this.parse(OrgOpenAgent);
    this.org = flags['target-org'];
    this.connection = this.org.getConnection(flags['api-version']);

    const [frontDoorUrl, retUrl] = await Promise.all([
      buildFrontdoorUrl(this.org, this.connection),
      buildRetUrl(this.connection, flags.name),
    ]);

    return this.openOrgUI(flags, frontDoorUrl, retUrl);
  }
}

// Build the URL part to the Agent Builder given a Bot API name.
const buildRetUrl = async (conn: Connection, botName: string): Promise<string> => {
  const query = `SELECT id FROM BotDefinition WHERE DeveloperName='${botName}'`;
  const botId = (await conn.singleRecordQuery<{ Id: string }>(query)).Id;
  return `AiCopilot/copilotStudio.app#/copilot/builder?copilotId=${botId}`;
};
