/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthInfo, ConfigAggregator, ConfigInfo, Connection, Org, SfdxError, Messages } from '@salesforce/core';
import { sortBy } from '@salesforce/kit';
import { Table } from 'cli-ux/lib';
import { ExtendedAuthFields, OrgListUtil } from '../../../shared/orgListUtil';
import { getStyledObject } from '../../../shared/orgHighlighter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'list');

export class OrgListCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('description');

  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    verbose: flags.builtin({
      description: messages.getMessage('verbose'),
    }),
    all: flags.boolean({
      description: messages.getMessage('all'),
    }),
    clean: flags.boolean({
      description: messages.getMessage('clean'),
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('noPrompt'),
    }),
    skipconnectionstatus: flags.boolean({
      description: messages.getMessage('skipConnectionStatus'),
    }),
  };

  public async run(): Promise<unknown> {
    let fileNames: string[] = [];
    try {
      fileNames = await AuthInfo.listAllAuthFiles();
    } catch (error) {
      if (error.name === 'NoAuthInfoFound') {
        throw new SfdxError(messages.getMessage('noOrgsFound'), 'noOrgsFound', [
          messages.getMessage('noOrgsFoundAction'),
        ]);
      } else {
        throw error;
      }
    }

    const sortFunction = (orgDetails): ExtendedAuthFields[] => {
      this.extractDefaultOrgStatus(orgDetails);
      return [orgDetails.alias, orgDetails.username];
    };
    const metaConfigs = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, this.flags);
    const groupedSortedOrgs = {
      nonScratchOrgs: sortBy(metaConfigs.nonScratchOrgs, sortFunction),
      expiredScratchOrgs: sortBy(metaConfigs.expiredScratchOrgs, sortFunction),
      activeScratchOrgs: sortBy(metaConfigs.activeScratchOrgs, sortFunction),
      totalScratchOrgs: sortBy(metaConfigs.totalScratchOrgs),
    };

    if (this.flags.clean && groupedSortedOrgs.expiredScratchOrgs.length > 0) {
      await this.cleanScratchOrgs(groupedSortedOrgs.expiredScratchOrgs, !this.flags.noprompt);
    }

    if (groupedSortedOrgs.expiredScratchOrgs.length > 10 && !this.flags.clean) {
      this.ux.warn(messages.getMessage('deleteOrgs', [groupedSortedOrgs.expiredScratchOrgs.length]));
    }

    const result = {
      nonScratchOrgs: groupedSortedOrgs.nonScratchOrgs,
      scratchOrgs: this.flags.all ? groupedSortedOrgs.totalScratchOrgs : groupedSortedOrgs.activeScratchOrgs,
    };

    this.ux.styledHeader('Orgs');

    this.printOrgTable(result.nonScratchOrgs, this.flags.skipconnectionstatus);
    // separate the table by a blank line.
    this.ux.log();
    this.printScratchOrgTable(result.scratchOrgs);

    return result;
  }

  protected async cleanScratchOrgs(scratchOrgs: ExtendedAuthFields[], prompt?: boolean): Promise<void> {
    if (prompt && (await this.ux.confirm(messages.getMessage('prompt', [scratchOrgs.length]))) === false) {
      return;
    }

    for (const fields of scratchOrgs) {
      try {
        const authInfo = await AuthInfo.create({ username: fields.username });
        const connection = await Connection.create({
          authInfo,
          configAggregator: ({
            // Force an api version to prevent connection check with the server for expired orgs.
            // tslint:disable-next-line: no-object-literal-type-assertion
            getInfo: () => (({ value: '47.0' } as unknown) as ConfigInfo),
          } as unknown) as ConfigAggregator,
        });
        const org = await Org.create({ aliasOrUsername: fields.username, connection });
        await org.remove();
      } catch (e) {
        this.logger.debug(`Error cleaning org ${fields.username}: ${e.message as string}`);
      }
    }
  }

  protected printOrgTable(data, skipconnectionstatus): void {
    // default columns for the non-scratch org list
    const nonScratchOrgColumns = [
      { key: 'defaultMarker', label: '' },
      { key: 'alias', label: 'ALIAS' },
      { key: 'username', label: 'USERNAME' },
      { key: 'orgId', label: 'ORG ID' },
    ];

    if (!skipconnectionstatus) {
      nonScratchOrgColumns.push({ key: 'connectedStatus', label: 'CONNECTED STATUS' });
    }

    if (data.length) {
      this.ux.table(
        data.map((row) => getStyledObject(row)),
        { columns: nonScratchOrgColumns }
      );
    } else {
      this.ux.log(messages.getMessage('noResultsFound'));
    }
  }

  private printScratchOrgTable(data): void {
    if (data.length === 0) {
      this.ux.log(messages.getMessage('noActiveScratchOrgs'));
    } else {
      // One or more rows are available.
      this.ux.table(
        data.map((row) => getStyledObject(row)),
        { columns: this.getScratchOrgColumnData() }
      );
    }
  }

  private extractDefaultOrgStatus(val): void {
    // I'll use the sort function as a decorator so I can eliminate the need to loop.
    if (val.isDefaultDevHubUsername) {
      val.defaultMarker = '(D)';
    } else if (val.isDefaultUsername) {
      val.defaultMarker = '(U)';
    }
  }

  private getScratchOrgColumnData(): Array<Partial<Table.TableColumn>> {
    // default columns for the scratch org list
    let scratchOrgColumns = [
      { key: 'defaultMarker', label: '' },
      { key: 'alias', label: 'ALIAS' },
      { key: 'username', label: 'USERNAME' },
      { key: 'orgId', label: 'ORG ID' },
    ];

    if (this.flags.all || this.flags.verbose) {
      scratchOrgColumns.push({ key: 'status', label: 'STATUS' });
    }

    // scratch org verbose columns
    if (this.flags.verbose) {
      scratchOrgColumns = [
        ...scratchOrgColumns,
        { key: 'devHubOrgId', label: 'DEV HUB' },
        { key: 'createdDate', label: 'CREATED DATE' },
        { key: 'instanceUrl', label: 'INSTANCE URL' },
      ];
    }

    // scratch org expiration date should be on the end.
    return scratchOrgColumns.concat([{ key: 'expirationDate', label: 'EXPIRATION DATE' }]);
  }
}
