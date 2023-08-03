/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, loglevel, SfCommand } from '@salesforce/sf-plugins-core';
import { AuthInfo, ConfigAggregator, ConfigInfo, Connection, Org, SfError, Messages, Logger } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import { OrgListUtil, identifyActiveOrgByStatus } from '../../shared/orgListUtil';
import { getStyledObject } from '../../shared/orgHighlighter';
import { ExtendedAuthFields, FullyPopulatedScratchOrgFields } from '../../shared/orgTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'list');

export type OrgListResult = {
  /**
   * @deprecated
   * preserved for backward json compatibility.  Duplicates devHubs, sandboxes, regularOrgs, which should be preferred*/
  nonScratchOrgs: ExtendedAuthFields[];
  scratchOrgs: FullyPopulatedScratchOrgFields[];
  sandboxes: ExtendedAuthFields[];
  regularOrgs: ExtendedAuthFields[];
  devHubs: ExtendedAuthFields[];
};

export class OrgListCommand extends SfCommand<OrgListResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:org:list'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    verbose: Flags.boolean({
      summary: messages.getMessage('flags.verbose.summary'),
    }),
    all: Flags.boolean({
      summary: messages.getMessage('flags.all.summary'),
    }),
    clean: Flags.boolean({
      summary: messages.getMessage('flags.clean.summary'),
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.no-prompt.summary'),
      dependsOn: ['clean'],
      aliases: ['noprompt'],
      deprecateAliases: true,
    }),
    'skip-connection-status': Flags.boolean({
      summary: messages.getMessage('flags.skip-connection-status.summary'),
      aliases: ['skipconnectionstatus'],
      deprecateAliases: true,
    }),
    loglevel,
  };

  private flags!: Interfaces.InferredFlags<typeof OrgListCommand.flags>;

  public async run(): Promise<OrgListResult> {
    const [{ flags }, fileNames] = await Promise.all([this.parse(OrgListCommand), getAuthFileNames()]);
    this.flags = flags;
    const metaConfigs = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
    const groupedSortedOrgs = {
      devHubs: metaConfigs.devHubs.map(decorateWithDefaultStatus).sort(comparator),
      regularOrgs: metaConfigs.regularOrgs.map(decorateWithDefaultStatus).sort(comparator),
      sandboxes: metaConfigs.sandboxes.map(decorateWithDefaultStatus).sort(comparator),
      nonScratchOrgs: metaConfigs.nonScratchOrgs.map(decorateWithDefaultStatus).sort(comparator),
      scratchOrgs: metaConfigs.scratchOrgs.map(decorateWithDefaultStatus).sort(comparator),
      expiredScratchOrgs: metaConfigs.scratchOrgs.filter((org) => !identifyActiveOrgByStatus(org)),
    };

    if (flags.clean && groupedSortedOrgs.expiredScratchOrgs.length > 0) {
      await this.cleanScratchOrgs(groupedSortedOrgs.expiredScratchOrgs, !flags['no-prompt']);
    }

    if (groupedSortedOrgs.expiredScratchOrgs.length > 10 && !flags.clean) {
      this.warn(messages.getMessage('deleteOrgs', [groupedSortedOrgs.expiredScratchOrgs.length]));
    }

    const result = {
      regularOrgs: groupedSortedOrgs.regularOrgs,
      sandboxes: groupedSortedOrgs.sandboxes,
      nonScratchOrgs: groupedSortedOrgs.nonScratchOrgs,
      devHubs: groupedSortedOrgs.devHubs,
      scratchOrgs: flags.all
        ? groupedSortedOrgs.scratchOrgs
        : groupedSortedOrgs.scratchOrgs.filter(identifyActiveOrgByStatus),
    };

    // this.printOrgTable(result.nonScratchOrgs, flags['skip-connection-status']);
    this.printOrgTable(result.devHubs, flags['skip-connection-status'], 'DevHubs');
    this.printOrgTable(result.regularOrgs, flags['skip-connection-status'], 'Orgs');
    this.printOrgTable(result.sandboxes, flags['skip-connection-status'], 'Sandboxes');

    this.printScratchOrgTable(result.scratchOrgs);

    return result;
  }

  protected async cleanScratchOrgs(scratchOrgs: ExtendedAuthFields[], prompt?: boolean): Promise<void> {
    if (prompt && (await this.confirm(messages.getMessage('prompt', [scratchOrgs.length]))) === false) {
      return;
    }

    await Promise.all(
      scratchOrgs.map(async (fields) => {
        try {
          const authInfo = await AuthInfo.create({ username: fields.username });
          const connection = await Connection.create({
            authInfo,
            configAggregator: {
              // Force an api version to prevent connection check with the server for expired orgs.
              getInfo: () => ({ value: '47.0' } as unknown as ConfigInfo),
            } as unknown as ConfigAggregator,
          });
          const org = await Org.create({ aliasOrUsername: fields.username, connection });
          await org.remove();
        } catch (e) {
          this.warn(messages.getMessage('cleanWarning', [fields.username, this.config.bin, fields.username]));
          if (e instanceof Error) {
            const logger = await Logger.child('org:list');
            logger.debug(`Error cleaning org ${fields.username}: ${e.message}`);
          }
        }
      })
    );
  }

  protected printOrgTable(nonScratchOrgs: ExtendedAuthFields[], skipconnectionstatus: boolean, title: string): void {
    if (!nonScratchOrgs.length) {
      this.info(messages.getMessage('noResultsFound', [title]));
    } else {
      this.info(title);
      const rows = nonScratchOrgs
        .map((row) => getStyledObject(row))
        .map((org) =>
          Object.fromEntries(
            Object.entries(org).filter(([key]) =>
              ['defaultMarker', 'alias', 'username', 'orgId', 'connectedStatus'].includes(key)
            )
          )
        );

      this.table(rows, {
        defaultMarker: {
          header: '',
          get: (data): string => data.defaultMarker ?? '',
        },
        alias: {
          header: 'ALIAS',
          get: (data): string => data.alias ?? '',
        },
        username: { header: 'USERNAME' },
        orgId: { header: 'ORG ID' },
        ...(!skipconnectionstatus ? { connectedStatus: { header: 'CONNECTED STATUS' } } : {}),
      });
    }
    this.log();
  }

  private printScratchOrgTable(scratchOrgs: FullyPopulatedScratchOrgFields[]): void {
    if (scratchOrgs.length === 0) {
      this.info(messages.getMessage('noActiveScratchOrgs'));
    } else {
      this.info(this.flags.all ? 'Scratch Orgs' : 'Active Scratch Orgs (use --all to see all)');
      // One or more rows are available.
      // we only need a few of the props for our table.  Oclif table doesn't like extra props non-string props.
      const rows = scratchOrgs
        .map(getStyledObject)
        .map((org) =>
          Object.fromEntries(
            Object.entries(org).filter(([key]) =>
              [
                'defaultMarker',
                'alias',
                'username',
                'orgId',
                'status',
                'expirationDate',
                'devHubOrgId',
                'createdDate',
                'instanceUrl',
              ].includes(key)
            )
          )
        );
      this.table(
        rows,
        {
          defaultMarker: {
            header: '',
            get: (data): string => data.defaultMarker ?? '',
          },
          alias: {
            header: 'ALIAS',
            get: (data): string => data.alias ?? '',
          },
          username: { header: 'USERNAME' },
          orgId: { header: 'ORG ID' },
          ...(this.flags.all || this.flags.verbose ? { status: { header: 'STATUS' } } : {}),
          ...(this.flags.verbose
            ? {
                devHubOrgId: { header: 'DEV HUB' },
                createdDate: { header: 'CREATED DATE' },
                instanceUrl: { header: 'INSTANCE URL' },
              }
            : {}),
          expirationDate: { header: 'EXPIRATION DATE' },
        }
        // {
        //   title: 'Scratch orgs',
        // }
      );
    }
    this.log();
  }
}

const decorateWithDefaultStatus = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(val: T): T => ({
  ...val,
  ...(val.isDefaultDevHubUsername ? { defaultMarker: '(D)' } : {}),
  ...(val.isDefaultUsername ? { defaultMarker: '(U)' } : {}),
});

// sort by alias then username
const comparator = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(a: T, b: T): number => {
  const aliasCompareResult = (a.alias ?? '').localeCompare(b.alias ?? '');
  return aliasCompareResult !== 0 ? aliasCompareResult : (a.username ?? '').localeCompare(b.username);
};

const getAuthFileNames = async (): Promise<string[]> => {
  try {
    return ((await AuthInfo.listAllAuthorizations()) ?? []).map((auth) => auth.username);
  } catch (err) {
    const error = err as SfError;
    if (error.name === 'NoAuthInfoFound') {
      throw new SfError(messages.getMessage('noOrgsFound'), 'noOrgsFound', [messages.getMessage('noOrgsFoundAction')]);
    } else {
      throw error;
    }
  }
};
