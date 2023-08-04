/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, loglevel, SfCommand } from '@salesforce/sf-plugins-core';
import { AuthInfo, ConfigAggregator, ConfigInfo, Connection, Org, SfError, Messages, Logger } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import * as chalk from 'chalk';
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

    this.printOrgTable({
      devHubs: result.devHubs,
      regularOrgs: result.regularOrgs,
      sandboxes: result.sandboxes,
      skipconnectionstatus: flags['skip-connection-status'],
    });
    this.printScratchOrgTable(result.scratchOrgs);

    this.info('Legend:  (D)=Default DevHub, (U)=Default Org');
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

  protected printOrgTable({
    devHubs,
    regularOrgs,
    sandboxes,
    skipconnectionstatus,
  }: {
    devHubs: ExtendedAuthFields[];
    regularOrgs: ExtendedAuthFields[];
    sandboxes: ExtendedAuthFields[];
    skipconnectionstatus: boolean;
  }): void {
    if (!devHubs.length && !regularOrgs.length && !sandboxes.length) {
      this.info(messages.getMessage('noResultsFound'));
      return;
    }
    this.log();
    this.info('Non-scratch orgs');
    const nonScratchOrgs = [
      ...devHubs
        .map(addType('DevHub'))
        .map(colorEveryFieldButConnectedStatus(chalk.cyanBright))
        .map((row) => getStyledObject(row)),

      ...regularOrgs.map(colorEveryFieldButConnectedStatus(chalk.magentaBright)).map((row) => getStyledObject(row)),

      ...sandboxes
        .map(addType('Sandbox'))
        .map(colorEveryFieldButConnectedStatus(chalk.yellowBright))
        .map((row) => getStyledObject(row)),
    ];

    this.table(
      nonScratchOrgs.map((org) =>
        Object.fromEntries(
          Object.entries(org).filter(([key]) =>
            ['type', 'defaultMarker', 'alias', 'username', 'orgId', 'connectedStatus'].includes(key)
          )
        )
      ),
      {
        defaultMarker: {
          header: '',
        },
        type: {
          header: 'Type',
        },
        alias: {
          header: 'Alias',
        },
        username: { header: 'Username' },
        orgId: { header: 'Org ID' },
        ...(!skipconnectionstatus ? { connectedStatus: { header: 'Status' } } : {}),
      }
    );

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
        .map((org) => Object.fromEntries(Object.entries(org).filter(scratchOrgFieldFilter)));
      this.table(rows, {
        defaultMarker: {
          header: '',
        },
        alias: {
          header: 'Alias',
        },
        username: { header: 'Username' },
        orgId: { header: 'Org ID' },
        ...(this.flags.all || this.flags.verbose ? { status: { header: 'Status' } } : {}),
        ...(this.flags.verbose
          ? {
              devHubOrgId: { header: 'Dev Hub ID' },
              instanceUrl: { header: 'Instance URL' },
              createdDate: { header: 'Created', get: (data): string => data.createdDate?.split('T')[0] ?? '' },
            }
          : {}),
        expirationDate: { header: 'Expires' },
      });
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
  const emptiesLast = Array(10).fill('z').join('');
  const aliasCompareResult = (a.alias ?? emptiesLast).localeCompare(b.alias ?? emptiesLast);
  return aliasCompareResult !== 0 ? aliasCompareResult : (a.username ?? emptiesLast).localeCompare(b.username);
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

type ExtendedAuthFieldsWithType = ExtendedAuthFields & { type?: string };
const addType =
  (type: string) =>
  (val: ExtendedAuthFields): ExtendedAuthFieldsWithType => ({ ...val, type });

const colorEveryFieldButConnectedStatus =
  (colorFn: chalk.Chalk) =>
  (row: ExtendedAuthFieldsWithType): ExtendedAuthFieldsWithType =>
    Object.fromEntries(
      Object.entries(row).map(([key, val]) => [
        key,
        typeof val === 'string' && key !== 'connectedStatus' ? colorFn(val) : val,
      ])
      // TS is not smart enough to know this didn't change any types
    ) as ExtendedAuthFieldsWithType;

const scratchOrgFieldFilter = ([key]: [string, string]): boolean =>
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
  ].includes(key);
