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
  nonScratchOrgs: ExtendedAuthFields[];
  scratchOrgs: FullyPopulatedScratchOrgFields[];
};
export class OrgListCommand extends SfCommand<OrgListResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    verbose: Flags.boolean({
      summary: messages.getMessage('verbose'),
    }),
    all: Flags.boolean({
      summary: messages.getMessage('all'),
    }),
    clean: Flags.boolean({
      summary: messages.getMessage('clean'),
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('noPrompt'),
      dependsOn: ['clean'],
      aliases: ['noprompt'],
      deprecateAliases: true,
    }),
    'skip-connection-status': Flags.boolean({
      summary: messages.getMessage('skipConnectionStatus'),
      aliases: ['skipconnectionstatus'],
      deprecateAliases: true,
    }),
    loglevel,
  };

  private flags!: Interfaces.InferredFlags<typeof OrgListCommand.flags>;

  // eslint-disable-next-line sf-plugin/should-parse-flags
  public async run(): Promise<OrgListResult> {
    const [{ flags }, fileNames] = await Promise.all([this.parse(OrgListCommand), getAuthFileNames()]);
    this.flags = flags;
    const metaConfigs = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
    const groupedSortedOrgs = {
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
      nonScratchOrgs: groupedSortedOrgs.nonScratchOrgs,
      scratchOrgs: flags.all
        ? groupedSortedOrgs.scratchOrgs
        : groupedSortedOrgs.scratchOrgs.filter(identifyActiveOrgByStatus),
    };

    this.printOrgTable(result.nonScratchOrgs, flags['skip-connection-status']);

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
          const err = e as SfError;
          const logger = await Logger.child('org:list');
          logger.debug(`Error cleaning org ${fields.username}: ${err.message}`);
          this.warn(
            `Unable to clean org with username ${fields.username}.  You can run "sfdx force:org:delete -u ${fields.username}" to remove it.`
          );
        }
      })
    );
  }

  protected printOrgTable(nonScratchOrgs: ExtendedAuthFields[], skipconnectionstatus: boolean): void {
    if (!nonScratchOrgs.length) {
      this.log(messages.getMessage('noResultsFound'));
    } else {
      const rows = nonScratchOrgs
        .map((row) => getStyledObject(row))
        .map((org) =>
          Object.fromEntries(
            Object.entries(org).filter(([key]) =>
              ['defaultMarker', 'alias', 'username', 'orgId', 'connectedStatus'].includes(key)
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
          ...(!skipconnectionstatus ? { connectedStatus: { header: 'CONNECTED STATUS' } } : {}),
        },
        {
          title: 'Non-scratch orgs',
        }
      );
    }
  }

  private printScratchOrgTable(scratchOrgs: FullyPopulatedScratchOrgFields[]): void {
    if (scratchOrgs.length === 0) {
      this.log(messages.getMessage('noActiveScratchOrgs'));
    } else {
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
        },
        {
          title: 'Scratch orgs',
        }
      );
    }
  }
}

const decorateWithDefaultStatus = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(val: T): T => ({
  ...val,
  ...(val.isDefaultDevHubUsername ? { defaultMarker: '(D)' } : {}),
  ...(val.isDefaultUsername ? { defaultMarker: '(U)' } : {}),
});

// sort by alias then username
const comparator = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(a: T, b: T): number => {
  const aAlias = (a.alias ?? '').toUpperCase();
  const bAlias = (b.alias ?? '').toUpperCase();

  if (aAlias < bAlias) {
    return -1;
  }
  if (aAlias > bAlias) {
    return 1;
  }

  // alias must match
  if (a.username < b.username) {
    return -1;
  }
  if (a.username > b.username) {
    return 1;
  }
  return 0;
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
