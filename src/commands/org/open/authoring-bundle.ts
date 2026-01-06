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
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open.authoring-bundle');

export class OrgOpenAuthoringBundle extends OrgOpenCommandBase<OrgOpenOutput> {
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
    const { flags } = await this.parse(OrgOpenAuthoringBundle);
    this.org = flags['target-org'];
    this.connection = this.org.getConnection(flags['api-version']);

    const authoringBundleRedirect = await buildRetUrl(this.connection, flags['api-name']);

    return this.openOrgUI(flags, await this.org.getFrontDoorUrl(authoringBundleRedirect));
  }
}

// Build the URL part to the Agent Authoring Builder given an Authoring Bundle API name.
const buildRetUrl = async (conn: Connection, bundleName: string): Promise<string> => {
  // Query for the authoring bundle project by DeveloperName
  const projectQuery = `SELECT Id FROM AiAuthoringBundle WHERE DeveloperName='${bundleName}'`;
  const project = await conn.singleRecordQuery<{ Id: string }>(projectQuery, { tooling: true });
  const projectId = project.Id;

  // Query for the latest/active version of the project
  const versionQuery = `SELECT Id FROM AgentAuthoringProjectVersion WHERE ProjectId='${projectId}' ORDER BY CreatedDate DESC LIMIT 1`;
  const version = await conn.singleRecordQuery<{ Id: string }>(versionQuery);
  const versionId = version.Id;

  return `AgentAuthoring/agentAuthoringBuilder.app#/project?projectId=${projectId}&projectVersionId=${versionId}`;
};
