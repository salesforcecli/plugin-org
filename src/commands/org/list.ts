/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Flags, loglevel, SfCommand } from '@salesforce/sf-plugins-core';
import { AuthInfo, ConfigAggregator, ConfigInfo, Connection, Org, SfError, Messages, Logger } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import chalk from 'chalk';
import { OrgListUtil, identifyActiveOrgByStatus } from '../../shared/orgListUtil.js';
import { getStyledObject } from '../../shared/orgHighlighter.js';
import { ExtendedAuthFields, FullyPopulatedScratchOrgFields } from '../../shared/orgTypes.js';

Messages.importMessagesDirectory(dirname(fileURLToPath(import.meta.url)));
const messages = Messages.loadMessages('@salesforce/plugin-org', 'list');

export const defaultOrgEmoji = '🍁';
export const defaultHubEmoji = '🌳';

export type OrgListResult = {
  /**
   * @deprecated
   * preserved for backward json compatibility.  Duplicates devHubs, sandboxes, regularOrgs, which should be preferred*/
  nonScratchOrgs: ExtendedAuthFields[];
  scratchOrgs: FullyPopulatedScratchOrgFields[];
  sandboxes: ExtendedAuthFields[];
  other: ExtendedAuthFields[];
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
    const metaConfigs = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(
      fileNames,
      flags['skip-connection-status']
    );
    const groupedSortedOrgs = {
      devHubs: metaConfigs.devHubs.map(decorateWithDefaultStatus).sort(comparator),
      other: metaConfigs.other.map(decorateWithDefaultStatus).sort(comparator),
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
      other: groupedSortedOrgs.other,
      sandboxes: groupedSortedOrgs.sandboxes,
      nonScratchOrgs: groupedSortedOrgs.nonScratchOrgs,
      devHubs: groupedSortedOrgs.devHubs,
      scratchOrgs: flags.all
        ? groupedSortedOrgs.scratchOrgs
        : groupedSortedOrgs.scratchOrgs.filter(identifyActiveOrgByStatus),
    };

    this.printOrgTable({
      devHubs: result.devHubs,
      other: result.other,
      sandboxes: result.sandboxes,
      scratchOrgs: result.scratchOrgs,
      skipconnectionstatus: flags['skip-connection-status'],
    });

    this.info(
      `
Legend:  ${defaultHubEmoji}=Default DevHub, ${defaultOrgEmoji}=Default Org ${
        flags.all ? '' : '     Use --all to see expired and deleted scratch orgs'
      }`
    );

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
    scratchOrgs,
    other,
    sandboxes,
    skipconnectionstatus,
  }: {
    devHubs: ExtendedAuthFields[];
    other: ExtendedAuthFields[];
    sandboxes: ExtendedAuthFields[];
    scratchOrgs: FullyPopulatedScratchOrgFields[];
    skipconnectionstatus: boolean;
  }): void {
    if (!devHubs.length && !other.length && !sandboxes.length) {
      this.info(messages.getMessage('noResultsFound'));
      return;
    }
    const allOrgs: Array<FullyPopulatedScratchOrgFields | ExtendedAuthFieldsWithType> = [
      ...devHubs
        .map(addType('DevHub'))
        .map(colorEveryFieldButConnectedStatus(chalk.cyanBright))
        .map((row) => getStyledObject(row))
        .map(statusToEmoji),

      ...other
        .map(colorEveryFieldButConnectedStatus(chalk.magentaBright))
        .map((row) => getStyledObject(row))
        .map(statusToEmoji),

      ...sandboxes
        .map(addType('Sandbox'))
        .map(colorEveryFieldButConnectedStatus(chalk.yellowBright))
        .map((row) => getStyledObject(row))
        .map(statusToEmoji),

      ...scratchOrgs
        .map((row) => ({ ...row, type: 'Scratch' }))
        .map(convertScratchOrgStatus)
        .map((row) => getStyledObject(row))
        .map(statusToEmoji),
    ];

    this.table(
      allOrgs.map((org) => Object.fromEntries(Object.entries(org).filter(fieldFilter))),
      {
        defaultMarker: {
          header: '',
        },
        type: {
          header: 'Type',
        },
        namespacePRefix: {
          header: 'NAMESPACE',
          get: (data): string => data[Org.Fields.NAMESPACE_PREFIX] ?? '',
        },
        alias: {
          header: 'Alias',
        },
        username: { header: 'Username' },
        orgId: { header: 'Org ID' },
        ...(!skipconnectionstatus ? { connectedStatus: { header: 'Status' } } : {}),
        ...(this.flags.verbose
          ? {
              instanceUrl: { header: 'Instance URL' },
              devHubOrgId: { header: 'Dev Hub ID' },
              createdDate: {
                header: 'Created',
                get: (data): string => (data.createdDate as string)?.split('T')?.[0] ?? '',
              },
            }
          : {}),
        expirationDate: { header: 'Expires' },
      }
    );
  }
}

const decorateWithDefaultStatus = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(val: T): T => ({
  ...val,
  ...(val.isDefaultDevHubUsername ? { defaultMarker: '(D)' } : {}),
  ...(val.isDefaultUsername ? { defaultMarker: '(U)' } : {}),
  ...(val.isDefaultDevHubUsername && val.isDefaultUsername ? { defaultMarker: '(D),(U)' } : {}),
});

const statusToEmoji = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(val: T): T => ({
  ...val,
  defaultMarker: val.defaultMarker?.replace('(D)', defaultHubEmoji)?.replace('(U)', defaultOrgEmoji),
});

const EMPTIES_LAST = 'zzzzzzzzzz';

// sort by alias then username
const comparator = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(a: T, b: T): number => {
  const aliasCompareResult = (a.alias ?? EMPTIES_LAST).localeCompare(b.alias ?? EMPTIES_LAST);
  return aliasCompareResult !== 0 ? aliasCompareResult : (a.username ?? EMPTIES_LAST).localeCompare(b.username);
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

const fieldFilter = ([key]: [string, string]): boolean =>
  [
    'defaultMarker',
    'alias',
    'username',
    'orgId',
    'status',
    'connectedStatus',
    'expirationDate',
    'devHubOrgId',
    'createdDate',
    'instanceUrl',
    'type',
    'createdDate',
  ].includes(key);

const convertScratchOrgStatus = (
  row: FullyPopulatedScratchOrgFields
): FullyPopulatedScratchOrgFields & { connectedStatus: string } => ({ ...row, connectedStatus: row.status });
