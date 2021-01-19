/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, join } from 'path';

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
    const orgs = await this.groupOrgs(contents, excludeProperties);

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

      this.processScratchOrgs(orgs.scratchOrgs),
    ]);

    return {
      nonScratchOrgs,
      scratchOrgs,
    };
  }

  public static async processScratchOrgs(scratchOrgs: ExtendedAuthFields[]): Promise<ExtendedAuthFields[]> {
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

    return this.reduceScratchOrgInfo(updatedContents, scratchOrgs);
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
    // AuthInfos that have a userId are from user create, not an "org-level" auth.  Omit them
    return allAuths.filter((authInfo) => !!authInfo && !authInfo.getFields().userId);
  }

  /**
   * Helper to group orgs by {scratchOrg, nonScratchOrgs}
   * Also identifies which are default orgs from config
   *
   * @param {object} contents -The authinfo retrieved from the auth files
   * @param {string[]} excludeProperties - properties to exclude from the grouped configs ex. ['refreshToken', 'clientSecret']
   * @private
   */
  public static async groupOrgs(authInfos: AuthInfo[], excludeProperties?: string[]): Promise<OrgGroups> {
    const output: OrgGroups = {
      scratchOrgs: [],
      nonScratchOrgs: [],
    };
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
    // Reduce the information to key value pairs with signupUsername as key
    const contentMap = updatedContents.reduce((map, scratchOrgInfo) => {
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
      } else {
        const logger = await OrgListUtil.retrieveLogger();
        logger.warn(`Can't find ${scratchOrgInfo.username} in the updated contents`);
      }
    }

    return orgs;
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
