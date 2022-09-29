/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthInfo, Messages, sfdc, SfError } from '@salesforce/core';
import { camelCaseToTitleCase } from '@salesforce/kit';
import { OrgDisplayReturn, ScratchOrgFields } from '../../../shared/orgTypes';
import { getAliasByUsername } from '../../../shared/utils';
import { getStyledValue } from '../../../shared/orgHighlighter';
import { OrgListUtil } from '../../../shared/orgListUtil';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'display');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');
export class OrgDisplayCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    verbose: flags.builtin(),
  };

  public async run(): Promise<OrgDisplayReturn> {
    try {
      // the auth file might have a stale access token.  We want to refresh it before getting the fields
      await this.org.refreshAuth();
    } catch (error) {
      // even if this fails, we want to display the information we can read from the auth file
      this.ux.warn('unable to refresh auth for org');
    }
    // translate to alias if necessary
    const authInfo = await AuthInfo.create({ username: this.org.getUsername() });
    const fields = authInfo.getFields(true);

    const isScratchOrg = fields.devHubUsername;
    const scratchOrgInfo = isScratchOrg ? await this.getScratchOrgInformation(fields.orgId) : {};

    const returnValue: OrgDisplayReturn = {
      // renamed properties
      id: fields.orgId,
      devHubId: fields.devHubUsername,

      // copied properties
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
      sfdxAuthUrl: this.flags.verbose && fields.refreshToken ? authInfo.getSfdxAuthUrl() : undefined,
      alias: await getAliasByUsername(fields.username),
    };
    this.ux.warn(sharedMessages.getMessage('SecurityWarning'));

    if (!this.flags.json) {
      this.print(returnValue);
    }
    return returnValue;
  }

  private print(result: OrgDisplayReturn): void {
    this.ux.log('');
    const tableRows = Object.keys(result)
      .filter((key) => result[key] !== undefined && result[key] !== null) // some values won't exist
      .sort() // this command always alphabetizes the table rows
      .map((key) => ({
        key: camelCaseToTitleCase(key),
        // TS won't infer types of the values of OrgDisplayReturn, even thought it's typed (they're all string or date)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
        value: getStyledValue(key, result[key]),
      }));

    this.ux.styledHeader('Org Description');
    this.ux.table(tableRows, {
      key: { header: 'KEY' },
      value: { header: 'VALUE' },
    });
  }

  private async getScratchOrgInformation(orgId: string): Promise<ScratchOrgFields> {
    const hubOrg = await this.org.getDevHubOrg();
    const result = (
      await OrgListUtil.retrieveScratchOrgInfoFromDevHub(hubOrg.getUsername(), [sfdc.trimTo15(orgId)])
    )[0];

    if (result) {
      return {
        status: result.Status,
        expirationDate: result.ExpirationDate,
        createdBy: result.CreatedBy?.Username,
        edition: result.Edition ?? undefined, // null for snapshot orgs, possibly others.  Marking it undefined keeps it out of json output
        namespace: result.Namespace ?? undefined, // may be null on server
        orgName: result.OrgName,
        createdDate: result.CreatedDate,
      };
    }
    throw new SfError(
      messages.getMessage('noScratchOrgInfoError', [sfdc.trimTo15(orgId), hubOrg.getUsername()]),
      'NoScratchInfo',
      [messages.getMessage('noScratchOrgInfoAction')]
    );
  }
}
