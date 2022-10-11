/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, join } from 'path';
import * as fs from 'fs/promises';

import { Org, AuthInfo, sfdc, SfdxConfigAggregator, Global, AuthFields, Logger, SfError } from '@salesforce/core';
import { Dictionary, JsonMap } from '@salesforce/ts-types';
import { Record } from 'jsforce';
import { omit } from '@salesforce/kit/lib';
import { getAliasByUsername } from './utils';
import { ScratchOrgInfoSObject, ExtendedAuthFields } from './orgTypes';

type OrgGroups = {
  nonScratchOrgs: ExtendedAuthFields[];
  scratchOrgs: ExtendedAuthFields[];
};

type ExtendedScratchOrgInfo = ScratchOrgInfoSObject & {
  devHubOrgId: string;
  attributes: {
    type: string;
    url: string;
  };
};

export class OrgListUtil {
  private static logger: Logger;

  public static async retrieveLogger(): Promise<Logger> {
    if (!OrgListUtil.logger) {
      OrgListUtil.logger = await Logger.child('OrgListUtil');
    }
    return OrgListUtil.logger;
  }

  /**
   * This method takes all locally configured orgs and organizes them into the following buckets:
   * { nonScratchOrgs: [{}], scratchOrgs: [{}] }
   * the scratchOrgInfo query.
   *
   * @param {string[]|null} userFilenames- an array of strings that are validated against the server.
   * @param {object} flags - the result of this.flags on an sfdx command
   */
  public static async readLocallyValidatedMetaConfigsGroupedByOrgType(
    userFilenames: string[],
    flags: Dictionary<string | boolean>
  ): Promise<OrgGroups> {
    const contents: AuthInfo[] = await OrgListUtil.readAuthFiles(userFilenames);
    const orgs = await OrgListUtil.groupOrgs(contents);

    // parallelize two very independent operations
    const [nonScratchOrgs, scratchOrgs] = await Promise.all([
      Promise.all(
        orgs.nonScratchOrgs.map(async (fields) => {
          if (!flags.skipconnectionstatus) {
            // skip completely if we're skipping the connection
            fields.connectedStatus = await OrgListUtil.determineConnectedStatusForNonScratchOrg(fields.username);
            if (!fields.isDevHub && fields.connectedStatus === 'Connected') {
              // activating DevHub setting is irreversible so don't waste time checking any org we already know is a hub
              fields.isDevHub = await OrgListUtil.checkNonScratchOrgIsDevHub(fields.username);
            }
          }
          return fields;
        })
      ),

      OrgListUtil.processScratchOrgs(orgs.scratchOrgs),
    ]);

    return {
      nonScratchOrgs,
      scratchOrgs,
    };
  }

  /**
   * Organizes the scratchOrgs by DevHub to optimize calls to retrieveScratchOrgInfoFromDevHub(), then calls reduceScratchOrgInfo()
   *
   * @param {ExtendedAuthFields[]} scratchOrgs- an array of strings that are validated against the server.
   * @returns the same scratch org list, but with updated information from the server.
   */
  public static async processScratchOrgs(scratchOrgs: ExtendedAuthFields[]): Promise<ExtendedAuthFields[]> {
    const orgIdsGroupedByDevHub = scratchOrgs
      .filter((fields) => fields.devHubUsername)
      .reduce((accum: Dictionary<string[]>, fields) => {
        accum[fields.devHubUsername] = [...(accum[fields.devHubUsername] ?? []), sfdc.trimTo15(fields.orgId)];
        return accum;
      }, {});
    const updatedContents = (
      await Promise.all(
        Object.entries(orgIdsGroupedByDevHub).map(async ([devHubUsername, orgIds]) =>
          OrgListUtil.retrieveScratchOrgInfoFromDevHub(devHubUsername, orgIds)
        )
      )
    ).reduce((accumulator, iterator) => [...accumulator, ...iterator], []);

    return OrgListUtil.reduceScratchOrgInfo(updatedContents, scratchOrgs);
  }

  /**
   * Used to retrieve authInfo of the auth files
   *
   * @param fileNames All the filenames in the global hidden folder
   */
  public static async readAuthFiles(fileNames: string[]): Promise<AuthInfo[]> {
    const orgFileNames = (await fs.readdir(Global.SFDX_DIR)).filter((filename: string) =>
      filename.match(/^00D.{15}\.json$/g)
    );

    const allAuths: AuthInfo[] = await Promise.all(
      fileNames.map(async (fileName) => {
        try {
          const orgUsername = basename(fileName, '.json');
          const auth = await AuthInfo.create({ username: orgUsername });

          const userId = auth?.getFields().userId;

          // no userid?  Definitely an org primary user
          if (!userId) {
            return auth;
          }
          const orgId = auth.getFields().orgId;

          const orgFileName = `${orgId}.json`;
          // if userId, it could be created from password:generate command.  If <orgId>.json doesn't exist, it's also not a secondary user auth file
          if (orgId && !orgFileNames.includes(orgFileName)) {
            return auth;
          }
          // Theory: within <orgId>.json, if the userId is the first entry, that's the primary username.
          if (orgFileNames.includes(orgFileName)) {
            const orgFileContent = JSON.parse(await fs.readFile(join(Global.SFDX_DIR, orgFileName), 'utf8')) as {
              usernames: string[];
            };
            const usernames = orgFileContent.usernames;
            if (usernames && usernames[0] === auth.getFields().username) {
              return auth;
            }
          }
        } catch (error) {
          const err = error as SfError;
          const logger = await OrgListUtil.retrieveLogger();
          logger.warn(`Problem reading file: ${fileName} skipping`);
          logger.warn(err.message);
        }
      })
    );
    return allAuths.filter((auth) => !!auth);
  }

  /**
   * Helper to group orgs by {scratchOrg, nonScratchOrgs}
   * Also identifies which are default orgs from config
   *
   * @param {object} contents -The authinfo retrieved from the auth files
   * @param {string[]} excludeProperties - properties to exclude from the grouped configs ex. ['refreshToken', 'clientSecret']
   * @private
   */
  public static async groupOrgs(authInfos: AuthInfo[]): Promise<OrgGroups> {
    const output: OrgGroups = {
      scratchOrgs: [],
      nonScratchOrgs: [],
    };
    const config = (await SfdxConfigAggregator.create()).getConfig();

    for (const authInfo of authInfos) {
      let currentValue: ExtendedAuthFields;
      try {
        currentValue = OrgListUtil.removeRestrictedInfoFromConfig(authInfo.getFields(true));
      } catch (error) {
        // eslint-disable-next-line no-await-in-loop
        const logger = await OrgListUtil.retrieveLogger();
        logger.warn(`Error decrypting ${authInfo.getUsername()}`);
        currentValue = OrgListUtil.removeRestrictedInfoFromConfig(authInfo.getFields());
      }

      // eslint-disable-next-line no-await-in-loop
      const [alias, lastUsed] = await Promise.all([
        getAliasByUsername(currentValue.username),
        fs.stat(join(Global.SFDX_DIR, `${currentValue.username}.json`)),
      ]);

      currentValue.alias = alias;
      currentValue.lastUsed = lastUsed.atime;

      OrgListUtil.identifyDefaultOrgs(currentValue, config);
      if (currentValue.devHubUsername) {
        output.scratchOrgs.push(currentValue);
      } else {
        output.nonScratchOrgs.push(currentValue);
      }
    }
    return output;
  }

  /**
   * Helper utility to remove sensitive information from a scratch org auth config. By default refreshTokens and client secrets are removed.
   *
   * @param {*} config - scratch org auth object.
   * @param {string[]} properties - properties to exclude ex ['refreshToken', 'clientSecret']
   * @returns the config less the sensitive information.
   */
  public static removeRestrictedInfoFromConfig(
    config: AuthFields,
    properties = ['refreshToken', 'clientSecret']
  ): AuthFields {
    return omit(config, properties);
  }

  /** Identify the default orgs */
  public static identifyDefaultOrgs(orgInfo: ExtendedAuthFields, config: JsonMap): void {
    if (config['target-org'] && (orgInfo.username === config['target-org'] || orgInfo.alias === config['target-org'])) {
      orgInfo.isDefaultUsername = true;
    } else if (
      config['target-dev-hub'] &&
      (orgInfo.username === config['target-dev-hub'] || orgInfo.alias === config['target-dev-hub'])
    ) {
      orgInfo.isDefaultDevHubUsername = true;
    }
  }

  public static async retrieveScratchOrgInfoFromDevHub(
    devHubUsername: string,
    orgIdsToQuery: string[]
  ): Promise<Array<Partial<Record> & ExtendedScratchOrgInfo>> {
    const fields = [
      'CreatedDate',
      'Edition',
      'Status',
      'ExpirationDate',
      'Namespace',
      'OrgName',
      'CreatedBy.Username',
      'SignupUsername',
    ];

    try {
      const devHubOrg = await Org.create({ aliasOrUsername: devHubUsername });
      const conn = devHubOrg.getConnection();
      const data = await conn
        .sobject('ScratchOrgInfo')
        .find<ExtendedScratchOrgInfo>({ ScratchOrg: { $in: orgIdsToQuery } }, fields);
      return data.map((org) => ({
        ...org,
        devHubOrgId: devHubOrg.getOrgId(),
      }));
    } catch (err) {
      const logger = await OrgListUtil.retrieveLogger();
      logger.warn(`Error querying ${devHubUsername} for ${orgIdsToQuery.length} orgIds`);
      return [];
    }
  }

  public static async reduceScratchOrgInfo(
    updatedContents: Array<Partial<Record> & ExtendedScratchOrgInfo>,
    orgs: ExtendedAuthFields[]
  ): Promise<ExtendedAuthFields[]> {
    // Reduce the information to key value pairs with signupUsername as key
    const contentMap: Dictionary<ExtendedScratchOrgInfo> = updatedContents.reduce((map, scratchOrgInfo) => {
      if (scratchOrgInfo) {
        map[scratchOrgInfo.SignupUsername] = scratchOrgInfo;
      }
      return map;
    }, {});

    for (const scratchOrgInfo of orgs) {
      const updatedOrgInfo = contentMap[scratchOrgInfo.username];
      if (updatedOrgInfo) {
        scratchOrgInfo.signupUsername = updatedOrgInfo.SignupUsername;
        scratchOrgInfo.createdBy = updatedOrgInfo.CreatedBy.Username;
        scratchOrgInfo.createdDate = updatedOrgInfo.CreatedDate;
        scratchOrgInfo.devHubOrgId = updatedOrgInfo.devHubOrgId;
        scratchOrgInfo.attributes = updatedOrgInfo.attributes;
        scratchOrgInfo.orgName = updatedOrgInfo.OrgName;
        scratchOrgInfo.edition = updatedOrgInfo.Edition;
        scratchOrgInfo.status = updatedOrgInfo.Status;
        scratchOrgInfo.expirationDate = updatedOrgInfo.ExpirationDate;
        scratchOrgInfo.isExpired = updatedOrgInfo.Status === 'Deleted';
        scratchOrgInfo.namespace = updatedOrgInfo.Namespace;
      } else {
        // eslint-disable-next-line no-await-in-loop
        const logger = await OrgListUtil.retrieveLogger();
        logger.warn(`Can't find ${scratchOrgInfo.username} in the updated contents`);
      }
    }

    return orgs;
  }

  /**
   * Asks the org if it's a devHub.  Because the dev hub setting can't be deactivated, only ask orgs that aren't already stored as hubs.
   * This has a number of side effects, including updating the AuthInfo files and
   *
   * @param username org to check for devHub status
   * @returns {Promise.<boolean>}
   */
  public static async checkNonScratchOrgIsDevHub(username: string): Promise<boolean> {
    try {
      const org = await Org.create({ aliasOrUsername: username });
      // true forces a server check instead of relying on AuthInfo file cache
      return await org.determineIfDevHubOrg(true);
    } catch {
      return false;
    }
  }

  /**
   * retrieves the connection info of an nonscratch org
   *
   * @param username The username used when the org was authenticated
   * @returns {Promise.<string>}
   */
  public static async determineConnectedStatusForNonScratchOrg(username: string): Promise<string> {
    try {
      const org = await Org.create({ aliasOrUsername: username });

      if (org.getField(Org.Fields.DEV_HUB_USERNAME)) {
        return;
      }

      try {
        await org.refreshAuth();
        return 'Connected';
      } catch (err) {
        const error = err as SfError;
        const logger = await OrgListUtil.retrieveLogger();
        logger.trace(`error refreshing auth for org: ${org.getUsername()}`);
        logger.trace(error);
        return (error.code ?? error.message) as string;
      }
    } catch (err) {
      const error = err as SfError;
      const logger = await OrgListUtil.retrieveLogger();
      logger.trace(`error refreshing auth for org: ${username}`);
      logger.trace(error);
      return (error.code ?? error.message ?? 'Unknown') as string;
    }
  }
}

export const identifyActiveOrgByStatus = (org: ExtendedAuthFields): boolean => org.status === 'Active';
