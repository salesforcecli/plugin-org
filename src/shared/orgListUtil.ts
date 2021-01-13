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

export interface ExtendedAuthFields extends AuthFields {
  lastUsed?: Date;
  orgName?: string;
  edition?: string;
  signupUsername?: string;
  devHubOrgId?: string;
  isExpired?: boolean;
  connectedStatus?: string;
  status?: string;
  isDefaultUsername?: boolean;
  isDefaultDevHubUsername?: boolean;
  createdBy?: string;
  createdDate?: string;
  attributes?: object;
}

type OrgGroups = {
  nonScratchOrgs: ExtendedAuthFields[];
  activeScratchOrgs: ExtendedAuthFields[];
  expiredScratchOrgs: ExtendedAuthFields[];
  queryExpirationDate: ExtendedAuthFields[];
  totalScratchOrgs: ExtendedAuthFields[];
};

type ScratchOrgInfo = {
  Id: string;
  SignupUsername: string;
  ExpirationDate: string;
};

type ExtendedScratchOrgInfo = ScratchOrgInfo & {
  devHubOrgId: string;
  connectedStatus: string;
};

export class OrgListUtil {
  private static logger;

  private static accum: OrgGroups = {
    nonScratchOrgs: [],
    activeScratchOrgs: [],
    expiredScratchOrgs: [],
    queryExpirationDate: [],
    totalScratchOrgs: [],
  };

  public static async retrieveLogger(): Promise<Logger> {
    if (!OrgListUtil.logger) {
      OrgListUtil.logger = await Logger.child('OrgListUtil');
    }
    return OrgListUtil.logger;
  }

  /**
   * This method takes all locally configured orgs and organizes them into the following buckets:
   * { activeScratchOrgs: [{}], nonScratchOrgs: [{}], scratchOrgs: [{}] }
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

    const authInfos: Dictionary<AuthInfo> = contents.reduce((map, content) => {
      if (content) {
        map[content.getUsername()] = content;
      }
      return map;
    }, {});

    const orgs = await this.groupOrgs(contents, this.accum, excludeProperties);

    /** Retrieve scratch org info for scratch orgs that do not have exp date in their auth files */
    await Promise.all(
      orgs.queryExpirationDate.map(async (fields) => {
        if (fields.devHubUsername) {
          try {
            const devHubOrg = await Org.create({ aliasOrUsername: fields.devHubUsername });
            const authInfo = authInfos[fields.username];
            if (authInfo) {
              await this.retrieveScratchOrgExpDate(devHubOrg, sfdc.trimTo15(fields.orgId), authInfo);
            }
          } catch (err) {
            // Throwing an error will cause the command to exit with the error. We just want the exp date information of all orgs.
          }
        }
      })
    );

    const allScratchOrgs = orgs.activeScratchOrgs.concat(orgs.expiredScratchOrgs);
    orgs.totalScratchOrgs = allScratchOrgs;

    /** Ensure additional fields have been added to the scratchOrg info */
    if (flags.verbose || flags.json) {
      const orgIdsToQuery: Dictionary<string[]> = {};
      const orgsToQuery = flags.all ? orgs.totalScratchOrgs : orgs.activeScratchOrgs;
      orgsToQuery.forEach((fields) => {
        if (fields.devHubUsername) {
          if (!orgIdsToQuery[fields.devHubUsername]) {
            orgIdsToQuery[fields.devHubUsername] = [];
          }
          orgIdsToQuery[fields.devHubUsername].push(sfdc.trimTo15(fields.orgId));
        }
      });

      const updatedContents = (
        await Promise.all(
          Object.entries(orgIdsToQuery).map(async ([username, orgIds]) => {
            const data = await this.retrieveScratchOrgInfoFromDevHub(username, orgIds);
            return data;
          })
        )
      )
        // eslint-disable-next-line no-shadow
        .reduce((list, contents) => [...list, ...contents], []);

      const resultOrgInfo = await this.reduceScratchOrgInfo(updatedContents, orgsToQuery);
      if (flags.all) {
        orgs.totalScratchOrgs = resultOrgInfo;
      } else {
        orgs.activeScratchOrgs = resultOrgInfo;
      }
    }

    if (flags.skipconnectionstatus) {
      return orgs;
    }
    await Promise.all(orgs.nonScratchOrgs.map((fields) => this.determineDevHubConnStatus(fields)));

    return orgs;
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
   * retrieves the connection info of an nonscratch org
   *
   * @returns {BBPromise.<array>}
   */
  public static async determineDevHubConnStatus(fields: ExtendedAuthFields): Promise<void> {
    try {
      const org = await Org.create({ aliasOrUsername: fields.username });

      // Do the query for orgs without a devHubUsername attribute. In some cases scratch org auth
      // files may not have a devHubUsername property; but that's ok. We will discover it before this.
      const devHubUsername = org.getField(Org.Fields.DEV_HUB_USERNAME);
      if (!devHubUsername) {
        try {
          await org.refreshAuth();
          fields.connectedStatus = 'Connected';
        } catch (error) {
          const logger = await OrgListUtil.retrieveLogger();
          logger.trace(`error refreshing auth for org: ${org.getUsername()}`);
          logger.trace(error);
          fields.connectedStatus = error['code'] || error.message;
        }
      }
      // Don't do anything if it isn't devhub
    } catch (e) {
      fields.connectedStatus = 'Unknown';
    }
  }

  /**
   * Helper to group orgs by {activeScratchOrgs, scratchOrg, nonScratchOrgs}
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
      const fields = authInfo.getFields();
      const currentValue = OrgListUtil.removeRestrictedInfoFromConfig(fields, excludeProperties) as ExtendedAuthFields;

      currentValue.alias = await getAliasByUsername(fields.username);
      currentValue.lastUsed = fs.statSync(join(Global.DIR, `${fields.username}.json`)).atime;

      this.identifyDefaultOrgs(currentValue, config);
      if (currentValue.devHubUsername) {
        if (!currentValue.expirationDate) {
          accum['queryExpirationDate'].push(currentValue);
        } else if (OrgListUtil.identifyActiveOrgs(currentValue.expirationDate)) {
          currentValue.status = 'Active';
          currentValue.isExpired = false;
          accum['activeScratchOrgs'].push(currentValue);
        } else {
          currentValue.status = 'Expired';
          currentValue.isExpired = true;
          accum['expiredScratchOrgs'].push(currentValue);
        }
      } else {
        accum['nonScratchOrgs'].push(currentValue);
      }
    }
    return accum;
  }

  public static async retrieveScratchOrgExpDate(devHub: Org, orgId: string, authInfo: AuthInfo): Promise<void> {
    const fields = ['ExpirationDate'];
    const conn = devHub.getConnection();
    const object = await conn.sobject('ScratchOrgInfo').find<ScratchOrgInfo>({ ScratchOrg: orgId }, fields);

    if (object.length > 0) {
      // There should only be one.
      await this.writeFieldsToAuthFile(object[0], authInfo);
    }
  }

  public static async writeFieldsToAuthFile(
    scratchOrgInfo: ScratchOrgInfo,
    authInfo: AuthInfo,
    excludeProperties?: string[]
  ): Promise<void> {
    let authInfoFields = authInfo.getFields() as ExtendedAuthFields;

    if (!authInfoFields['ExpirationDate']) {
      await authInfo.save({ expirationDate: scratchOrgInfo.ExpirationDate });

      authInfoFields = OrgListUtil.removeRestrictedInfoFromConfig(
        authInfoFields,
        excludeProperties
      ) as ExtendedAuthFields;
      authInfoFields.alias = await getAliasByUsername(authInfoFields.username);
      authInfoFields.lastUsed = fs.statSync(join(Global.DIR, `${authInfoFields.username}.json`)).atime;

      if (this.identifyActiveOrgs(authInfoFields.expirationDate)) {
        authInfoFields['status'] = 'Active';
        authInfoFields.isExpired = false;
        this.accum.activeScratchOrgs.push(authInfoFields);
      } else {
        authInfoFields['status'] = 'Expired';
        authInfoFields.isExpired = true;
        this.accum.expiredScratchOrgs.push(authInfoFields);
      }
    }
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
  public static identifyActiveOrgs(expirationDate): boolean {
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
    username: string,
    orgIdsToQuery: string[]
  ): Promise<Array<Record<ExtendedScratchOrgInfo>>> {
    const fields = ['OrgName', 'CreatedBy.Username', 'CreatedDate', 'Edition', 'SignupUsername'];

    try {
      const devHubOrg = await Org.create({ aliasOrUsername: username });
      const conn = devHubOrg.getConnection();
      const data = await conn
        .sobject('ScratchOrgInfo')
        .find<ExtendedScratchOrgInfo>({ ScratchOrg: { $in: orgIdsToQuery } }, fields);
      data.map((org) => {
        org.devHubOrgId = devHubOrg.getOrgId();
        /** For orgs that are not dev hubs, we need not return a connectedStatus */
        org.connectedStatus = 'Unknown';
        return org;
      });
      return data;
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
        scratchOrgInfo.connectedStatus = updatedOrgInfo.connectedStatus;
      } else {
        const logger = await OrgListUtil.retrieveLogger();
        logger.warn(`Can't find ${scratchOrgInfo.username} in the updated contents`);
      }
    }
    return orgs;
  }
}
