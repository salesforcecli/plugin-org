/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, join } from 'path';
import * as moment from 'moment';

import { Org, AuthInfo, fs, sfdc, ConfigAggregator, Global, AuthFields, Logger } from '@salesforce/core';
import { Dictionary, JsonMap } from '@salesforce/ts-types';
import { Record } from 'jsforce';
import { omit } from '@salesforce/kit/lib';
import { getAliasByUsername } from './utils';
import { ScratchOrgInfoSObject } from './orgTypes';
export interface ExtendedAuthFields extends AuthFields {
  lastUsed?: Date;
  orgName?: string; // covered in ScratchOrgField
  edition?: string; // covered in ScratchOrgField
  signupUsername?: string;
  devHubOrgId?: string;
  isExpired?: boolean;
  connectedStatus?: string; // covered
  status?: string; // covered in ScratchOrgField
  isDefaultUsername?: boolean;
  isDefaultDevHubUsername?: boolean;
  createdBy?: string; // covered in ScratchOrgField
  createdDate?: string; // covered in ScratchOrgField
  attributes?: object;
}

type OrgGroups = {
  nonScratchOrgs: ExtendedAuthFields[];
  scratchOrgs: ExtendedAuthFields[];
};

type ExtendedScratchOrgInfo = ScratchOrgInfoSObject & {
  devHubOrgId: string;
};

export class OrgListUtil {
  private static logger;

  private static accum: OrgGroups = {
    nonScratchOrgs: [],
    scratchOrgs: [],
  };

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
   * @param {string[]|null} excludeProperties - properties to exclude from the configs defaults. ['refreshToken', 'clientSecret']. Specify null to include all properties.
   * @param {string[]|null} userFilenames- an array of strings that are validated against the server.
   */
  public static async readLocallyValidatedMetaConfigsGroupedByOrgType(
    userFilenames: string[],
    flags,
    excludeProperties?: string[]
  ): Promise<OrgGroups> {
    const contents: AuthInfo[] = await this.readAuthFiles(userFilenames);
    const orgs = await this.groupOrgs(contents, this.accum, excludeProperties);

    // parallelize two very independent operations
    const [nonScratchOrgs, scratchOrgs] = await Promise.all([
      Promise.all(
        orgs.nonScratchOrgs.map(async (fields) => {
          if (flags.skipconnectionstatus) {
            fields.connectedStatus = fields.connectedStatus || 'Unknown';
          } else {
            fields.connectedStatus = await this.determineConnectedStatusForNonScratchOrg(fields.username);
          }
          return fields;
        })
      ),

      this.processScratchOrgs(orgs.scratchOrgs, flags.all),
    ]);

    return {
      nonScratchOrgs,
      scratchOrgs,
    };
  }

  public static async processScratchOrgs(
    scratchOrgs: ExtendedAuthFields[],
    includeExpired: boolean
  ): Promise<ExtendedAuthFields[]> {
    // organize by DevHub to reduce queries
    const orgIdsGroupedByDevHub: Dictionary<string[]> = {};
    scratchOrgs.forEach((fields) => {
      if (fields.devHubUsername) {
        if (!orgIdsGroupedByDevHub[fields.devHubUsername]) {
          orgIdsGroupedByDevHub[fields.devHubUsername] = [];
        }
        orgIdsGroupedByDevHub[fields.devHubUsername].push(sfdc.trimTo15(fields.orgId));
      }
    });
    const updatedContents = (
      await Promise.all(
        Object.entries(orgIdsGroupedByDevHub).map(async ([devHubUsername, orgIds]) =>
          this.retrieveScratchOrgInfoFromDevHub(devHubUsername, orgIds)
        )
      )
    ).reduce((accumulator, iterator) => [...accumulator, ...iterator], []);

    const resultOrgInfo = await this.reduceScratchOrgInfo(updatedContents, scratchOrgs);
    if (includeExpired) return resultOrgInfo;
    return resultOrgInfo.filter((org) => org.status === 'Active');
  }

  /**
   * Used to retrieve authInfo of the auth files
   *
   * @param fileNames All the filenames in the global hidden folder
   */
  public static async readAuthFiles(fileNames: string[]): Promise<AuthInfo[]> {
    const allAuths: AuthInfo[] = await Promise.all(
      fileNames.map(async (fileName) => {
        try {
          const orgUsername = basename(fileName, '.json');
          return AuthInfo.create({ username: orgUsername });
        } catch (err) {
          const logger = await OrgListUtil.retrieveLogger();
          logger.warn(`Problem reading file: ${fileName} skipping`);
          logger.warn(err.message);
        }
      })
    );
    return allAuths.filter((authInfo) => !!authInfo);
  }

  /**
   * Helper to group orgs by {scratchOrg, nonScratchOrgs}
   * Also identifies which are default orgs from config
   *
   * @param {object} contents -The authinfo retrieved from the auth files
   * @param {string[]} excludeProperties - properties to exclude from the grouped configs ex. ['refreshToken', 'clientSecret']
   * @private
   */
  public static async groupOrgs(
    authInfos: AuthInfo[],
    accum: OrgGroups,
    excludeProperties?: string[]
  ): Promise<OrgGroups> {
    const config = (await ConfigAggregator.create()).getConfig();

    for (const authInfo of authInfos) {
      const currentValue = OrgListUtil.removeRestrictedInfoFromConfig(
        authInfo.getFields(),
        excludeProperties
      ) as ExtendedAuthFields;

      const [alias, lastUsed] = await Promise.all([
        getAliasByUsername(currentValue.username),
        fs.stat(join(Global.DIR, `${currentValue.username}.json`)),
      ]);

      currentValue.alias = alias;
      currentValue.lastUsed = lastUsed.atime;

      this.identifyDefaultOrgs(currentValue, config);
      if (currentValue.devHubUsername) {
        accum.scratchOrgs.push(currentValue);
      } else {
        accum.nonScratchOrgs.push(currentValue);
      }
    }
    return accum;
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

  /**
   * Helper to identify active orgs based on the expiration data.
   *
   * @param expirationDate
   */
  public static identifyActiveOrgsByDate(expirationDate): boolean {
    return moment(expirationDate).isAfter(moment());
  }

  /** Identify the default orgs */
  public static identifyDefaultOrgs(orgInfo: ExtendedAuthFields, config: JsonMap): void {
    if (
      config.defaultusername &&
      (orgInfo.username === config.defaultusername || orgInfo.alias === config.defaultusername)
    ) {
      orgInfo.isDefaultUsername = true;
    } else if (
      config.defaultdevhubusername &&
      (orgInfo.username === config.defaultdevhubusername || orgInfo.alias === config.defaultdevhubusername)
    ) {
      orgInfo.isDefaultDevHubUsername = true;
    }
  }

  public static async retrieveScratchOrgInfoFromDevHub(
    devHubUsername: string,
    orgIdsToQuery: string[]
  ): Promise<Array<Record<ExtendedScratchOrgInfo>>> {
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
      return [];
    }
  }

  public static async reduceScratchOrgInfo(
    updatedContents: Array<Record<ExtendedScratchOrgInfo>>,
    orgs: ExtendedAuthFields[]
  ): Promise<ExtendedAuthFields[]> {
    /** Reduce the information to key value pairs with signupUsername as key */
    const contentMap = updatedContents.reduce((map, scratchOrgInfo) => {
      if (scratchOrgInfo) {
        map[scratchOrgInfo.SignupUsername] = scratchOrgInfo;
      }
      return map;
    }, {});

    // const orgsForLocalUpdate = [];

    for (const scratchOrgInfo of orgs) {
      const updatedOrgInfo = contentMap[scratchOrgInfo.username];
      if (updatedOrgInfo) {
        // if the org has changed, mark it for local write.  After the update, we'll write orgs that changed
        // const shouldWrite = scratchOrgInfo.expirationDate !== updatedOrgInfo.ExpirationDate;
        scratchOrgInfo.signupUsername = updatedOrgInfo.SignupUsername;
        scratchOrgInfo.createdBy = updatedOrgInfo.CreatedBy.Username;
        scratchOrgInfo.createdDate = updatedOrgInfo.CreatedDate;
        scratchOrgInfo.devHubOrgId = updatedOrgInfo.devHubOrgId;
        scratchOrgInfo.attributes = updatedOrgInfo.attributes;
        scratchOrgInfo.orgName = updatedOrgInfo.OrgName;
        scratchOrgInfo.edition = updatedOrgInfo.Edition;

        scratchOrgInfo.status = updatedOrgInfo.Status;
        scratchOrgInfo.expirationDate = updatedOrgInfo.ExpirationDate;

        // if (shouldWrite) {
        //   orgsForLocalUpdate.push(scratchOrgInfo);
        // }
      } else {
        const logger = await OrgListUtil.retrieveLogger();
        logger.warn(`Can't find ${scratchOrgInfo.username} in the updated contents`);
      }
    }

    // // write the orgs that changed expiration dates?
    // Promise.all(
    //   orgsForLocalUpdate.map(async (org) => {
    //     const auth = await AuthInfo.create({ username: org.username });
    //     auth.save({
    //       ...auth.getFields(),
    //       expirationDate: org.expirateionDate,
    //     });
    //   })
    // );
    return orgs;
  }

  /**
   * retrieves the connection info of an nonscratch org
   *
   * @returns {Promise.<string>}
   */
  public static async determineConnectedStatusForNonScratchOrg(username: string): Promise<string> {
    try {
      const org = await Org.create({ aliasOrUsername: username });

      // Do the query for orgs without a devHubUsername attribute. In some cases scratch org auth
      // files may not have a devHubUsername property; but that's ok. We will discover it before this.
      if (org.getField(Org.Fields.DEV_HUB_USERNAME)) {
        return;
      }

      try {
        await org.refreshAuth();
        return 'Connected';
      } catch (error) {
        const logger = await OrgListUtil.retrieveLogger();
        logger.trace(`error refreshing auth for org: ${org.getUsername()}`);
        logger.trace(error);
        return error['code'] || error.message;
      }
    } catch (e) {
      return 'Unknown';
    }
  }
}

export const identifyActiveOrgByStatus = (org: ExtendedAuthFields): boolean => {
  return org.status === 'Active';
};
