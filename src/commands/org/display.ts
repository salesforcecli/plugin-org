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

import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
  loglevel,
  orgApiVersionFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import { AuthInfo, Messages, Org, SfError, trimTo15 } from '@salesforce/core';
import { camelCaseToTitleCase } from '@salesforce/kit';
import { AuthFieldsFromFS, OrgDisplayReturn, ScratchOrgFields } from '../../shared/orgTypes.js';
import { getAliasByUsername } from '../../shared/utils.js';
import { getStyledValue } from '../../shared/orgHighlighter.js';
import { OrgListUtil } from '../../shared/orgListUtil.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'display');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');
export class OrgDisplayCommand extends SfCommand<OrgDisplayReturn> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:org:display'];
  public static deprecateAliases = true;

  public static readonly flags = {
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': orgApiVersionFlagWithDeprecations,
    verbose: Flags.boolean({
      summary: messages.getMessage('flags.verbose.summary'),
    }),
    loglevel,
  };

  private org!: Org;

  public async run(): Promise<OrgDisplayReturn> {
    const { flags } = await this.parse(OrgDisplayCommand);
    this.org = flags['target-org'];
    this.org.getConnection(flags['api-version']);
    try {
      // the auth file might have a stale access token.  We want to refresh it before getting the fields
      await this.org.refreshAuth();
    } catch (error) {
      // even if this fails, we want to display the information we can read from the auth file
      this.warn('unable to refresh auth for org');
    }
    // translate to alias if necessary
    const authInfo = await AuthInfo.create({ username: this.org.getUsername() });
    const fields = authInfo.getFields(true) as AuthFieldsFromFS;

    const isScratchOrg = Boolean(fields.devHubUsername);
    const scratchOrgInfo = isScratchOrg && fields.orgId ? await this.getScratchOrgInformation(fields) : {};

    const returnValue: OrgDisplayReturn = {
      // renamed properties
      id: fields.orgId,
      devHubId: fields.devHubUsername,

      // copied properties
      apiVersion: fields.instanceApiVersion,
      accessToken: fields.accessToken,
      instanceUrl: fields.instanceUrl,
      username: fields.username,
      clientId: fields.clientId,
      password: fields.password,
      ...scratchOrgInfo,

      // properties with more complex logic
      connectedStatus: isScratchOrg
        ? undefined
        : await OrgListUtil.determineConnectedStatusForNonScratchOrg(fields.username),
      sfdxAuthUrl: flags.verbose && fields.refreshToken ? authInfo.getSfdxAuthUrl() : undefined,
      alias: await getAliasByUsername(fields.username),
      clientApps: fields.clientApps ? Object.keys(fields.clientApps).join(',') : undefined,
    };
    this.warn(sharedMessages.getMessage('SecurityWarning'));
    this.print(returnValue);
    return returnValue;
  }

  private print(result: OrgDisplayReturn): void {
    this.log();
    const tableRows = Object.entries(result)
      .filter(([, value]) => value !== undefined && value !== null) // some values won't exist
      .sort() // this command always alphabetizes the table rows
      .map(([key, value]) => ({
        key: camelCaseToTitleCase(key),
        value: typeof value === 'string' ? getStyledValue(key, value) : value,
      }));

    this.table({
      overflow: 'wrap',
      data: tableRows,
      columns: [
        { key: 'key', name: 'KEY' },
        { key: 'value', name: 'VALUE' },
      ],
      title: 'Org Description',
    });
  }

  private async getScratchOrgInformation(fields: AuthFieldsFromFS): Promise<ScratchOrgFields> {
    const hubOrg = await this.org.getDevHubOrg();
    // we know this is a scratch org so it must have a hubOrg and that'll have a username
    const hubUsername = hubOrg?.getUsername() as string;

    // This query can return multiple records that match the 15 char ID because `ScratchOrgInfo.ScratchOrg` isn't a case-sensitive field
    // so we look for the record that matches the scratch org username in the auth file.
    // If that doesn't match (e.g., when calling `org display` with a username that is not the scratch org admin), use the instance URL
    const result = (await OrgListUtil.retrieveScratchOrgInfoFromDevHub(hubUsername, [trimTo15(fields.orgId)])).find(
      (rec) => rec.SignupUsername === fields.username || rec.LoginUrl === fields.instanceUrl
    );

    if (result) {
      return {
        status: result.Status,
        devHubId: hubUsername,
        expirationDate: result.ExpirationDate,
        createdBy: result.CreatedBy?.Username,
        edition: result.Edition ?? undefined, // null for snapshot orgs, possibly others.  Marking it undefined keeps it out of json output
        namespace: result.Namespace ?? undefined, // may be null on server
        orgName: result.OrgName,
        createdDate: result.CreatedDate,
        signupUsername: result.SignupUsername,
      };
    }
    throw new SfError(
      messages.getMessage('noScratchOrgInfoError', [trimTo15(fields.orgId), hubUsername]),
      'NoScratchInfo',
      [messages.getMessage('noScratchOrgInfoAction')]
    );
  }
}
