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

import { Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import { OrgOpenCommandBase } from '../../../shared/orgOpenCommandBase.js';
import { type OrgOpenOutput } from '../../../shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open.agent');

export class OrgOpenAgent extends OrgOpenCommandBase<OrgOpenOutput> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...OrgOpenCommandBase.flags,
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.api-name.summary'),
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

    const agentBuilderRedirect = await buildRetUrl(this.connection, flags['api-name']);

    return this.openOrgUI(flags, await this.org.getFrontDoorUrl(agentBuilderRedirect));
  }
}

// Build the URL part to the Agent Builder given a Bot API name.
const buildRetUrl = async (conn: Connection, botName: string): Promise<string> => {
  const query = `SELECT id FROM BotDefinition WHERE DeveloperName='${botName}'`;
  const botId = (await conn.singleRecordQuery<{ Id: string }>(query)).Id;
  return `AiCopilot/copilotStudio.app#/copilot/builder?copilotId=${botId}`;
};
