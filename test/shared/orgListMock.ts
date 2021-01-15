/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// import * as BBPromise from 'bluebird';
import * as moment from 'moment';

// import { Aliases, Connection, SfdxError } from '@salesforce/core';
// import * as Force from '../../../lib/core/force';
// import ScratchOrgApi = require('../../../lib/core/scratchOrgApi');
// import { OrgListUtil } from '../../src/shared/orgListUtil';

const DATE_FORMAT = 'YYYY-MM-DD';

const TEST_USERS = ['bar@foo.org', 'baz@foo.org', 'gaz@foo.org', 'woo@foo.org'];

const SERVER_DATA = new Map();
SERVER_DATA.set(TEST_USERS[0], {
  SignupUsername: TEST_USERS[0],
  OrgName: 'Bar',
  ExpirationDate: moment().add(-1, 'days').format(DATE_FORMAT),
  Status: 'Active',
  CreatedDate: '2017-04-11T20:59:48.000+0000',
  CreatedBy: { Username: 'Jimi Hendrix' },
  Edition: 'Developer',
  ScratchOrg: '00DB0000000IVWu',
});

SERVER_DATA.set(TEST_USERS[1], {
  SignupUsername: TEST_USERS[1],
  OrgName: 'Baz',
  ExpirationDate: moment().add(1, 'days').format(DATE_FORMAT),
  Status: 'Active',
  CreatedDate: '2017-04-11T17:58:43.000+0000',
  CreatedBy: { Username: 'SRV' },
  Edition: 'Developer',
  ScratchOrg: '00Dxx0000001hcF',
});

SERVER_DATA.set(TEST_USERS[3], {
  SignupUsername: TEST_USERS[3],
  OrgName: 'Woo',
  ExpirationDate: moment().add(1, 'days').format(DATE_FORMAT),
  Status: 'Deleted',
  CreatedDate: '2017-04-11T17:58:43.000+0000',
  CreatedBy: { Username: 'shenderson' },
  Edition: 'Developer',
  ScratchOrg: '00Dxx0000001hcG',
});

class OrgListMock {
  public static get devHubUsername() {
    return 'foo@example.com';
  }

  public static get testUsers() {
    return TEST_USERS;
  }

  public static get serverData() {
    return SERVER_DATA;
  }

  public static AUTH_INFO = {
    scratchOrgs: [
      {
        SignupUsername: TEST_USERS[0],
        OrgName: 'Bar',
        ExpirationDate: moment().add(-1, 'days').format(DATE_FORMAT),
        CreatedDate: '2017-04-11T20:59:48.000+0000',
        CreatedBy: { Username: 'Jimi Hendrix' },
        Edition: 'Developer',
        ScratchOrg: '00DB0000000IVWu',
        status: 'Expired',
      },
      {
        SignupUsername: TEST_USERS[1],
        OrgName: 'Baz',
        ExpirationDate: moment().add(1, 'days').format(DATE_FORMAT),
        CreatedDate: '2099-04-11T17:58:43.000+0000',
        CreatedBy: { Username: 'SRV' },
        Edition: 'Developer',
        ScratchOrg: '00Dxx0000001hcF',
        status: 'Active',
      },
      {
        SignupUsername: TEST_USERS[3],
        OrgName: 'Woo',
        ExpirationDate: moment().add(1, 'days').format(DATE_FORMAT),
        status: 'Expired',
        CreatedDate: '2099-04-11T17:58:43.000+0000',
        CreatedBy: { Username: 'shenderson' },
        Edition: 'Developer',
        ScratchOrg: '00Dxx0000001hcG',
      },
      {
        SignupUsername: TEST_USERS[2],
        OrgName: 'Baz',
        ExpirationDate: moment().add(1, 'days').format(DATE_FORMAT),
        CreatedDate: '2017-04-11T17:58:43.000+0000',
        CreatedBy: { Username: 'SRV' },
        Edition: 'Developer',
        ScratchOrg: '00Dxx0000001hcF',
        status: 'Active',
      },
    ],
    // activeScratchOrgs: [
    //   {
    //     SignupUsername: TEST_USERS[2],
    //     OrgName: 'Baz',
    //     ExpirationDate: moment().add(1, 'days').format(DATE_FORMAT),
    //     CreatedDate: '2017-04-11T17:58:43.000+0000',
    //     CreatedBy: { Username: 'SRV' },
    //     Edition: 'Developer',
    //     ScratchOrg: '00Dxx0000001hcF',
    //     status: 'Active',
    //   },
    //   {
    //     SignupUsername: TEST_USERS[1],
    //     OrgName: 'Baz',
    //     ExpirationDate: moment().add(1, 'days').format(DATE_FORMAT),
    //     CreatedDate: '2099-04-11T17:58:43.000+0000',
    //     CreatedBy: { Username: 'SRV' },
    //     Edition: 'Developer',
    //     ScratchOrg: '00Dxx0000001hcF',
    //     status: 'Active',
    //   },
    // ],
    nonScratchOrgs: [
      {
        username: 'foo@example.com',
        isDevHub: true,
        connectedStatus: 'Connected',
      },
    ],
    // expiredScratchOrgs: [
    //   {
    //     SignupUsername: TEST_USERS[0],
    //     OrgName: 'Bar',
    //     ExpirationDate: moment().add(-1, 'days').format(DATE_FORMAT),
    //     CreatedDate: '2017-04-11T20:59:48.000+0000',
    //     CreatedBy: { Username: 'Jimi Hendrix' },
    //     Edition: 'Developer',
    //     ScratchOrg: '00DB0000000IVWu',
    //     status: 'Expired',
    //   },
    // ],
  };

  // public static async setup(sandbox) {
  //   sandbox.stub(Connection.prototype, 'find').resolves((org) => {
  //     if (org.name === OrgListMock.devHubUsername) {
  //       return [SERVER_DATA.get(TEST_USERS[0]), SERVER_DATA.get(TEST_USERS[1]), SERVER_DATA.get(TEST_USERS[3])];
  //     }
  //     throw new SfdxError('INVALID_TYPE', 'INVALID_TYPE');
  //   });
  // }

  // public static retrieveAuthInfo(sandbox) {
  //   sandbox.stub(OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').callsFake(() => {
  //     return Promise.resolve(OrgListMock.AUTH_INFO);
  //   });
  // }

  // public static createOrgs(workspace, aliases = false) {
  //   const orgDependencies = new Map();
  //   // You cannot evaluate the configOrgs array with BBPromise.all(). You'll have a race condition when updating
  //   // sfdx-config with the default org values.
  //   return workspace
  //     .configureHubOrg()
  //     .then((config) => {
  //       orgDependencies.set(config.username, config);
  //       const promise = aliases ? Aliases.set('foo', config.username) : BBPromise.resolve();
  //       return promise.then(() =>
  //         workspace.configureScratchOrg(workspace.config, OrgListMock.testUsers[0], ScratchOrgApi.Defaults.USERNAME)
  //       );
  //     })
  //     .then((config) => {
  //       orgDependencies.set(config.username, config);
  //       const promise = aliases ? Aliases.set('bar', config.username) : BBPromise.resolve();
  //       return promise.then(() =>
  //         workspace.configureScratchOrg(workspace.config, OrgListMock.testUsers[1], ScratchOrgApi.Defaults.USERNAME)
  //       );
  //     })
  //     .then((config) => {
  //       orgDependencies.set(config.username, config);
  //       const promise = aliases ? Aliases.set('baz', config.username) : BBPromise.resolve();

  //       return promise.then(() =>
  //         workspace.configureOrg(workspace.config, OrgListMock.testUsers[2], ScratchOrgApi.Defaults.USERNAME)
  //       );
  //     })
  //     .then((config) => {
  //       orgDependencies.set(config.username, config);
  //       const promise = aliases ? Aliases.set('gaz', config.username) : BBPromise.resolve();

  //       return promise.then(() => workspace.configureScratchOrg(workspace.config, OrgListMock.testUsers[3]));
  //     })
  //     .then((config) => {
  //       orgDependencies.set(config.username, config);
  //       const promise = aliases ? Aliases.set('woo', config.username).then(() => orgDependencies) : BBPromise.resolve();
  //       return promise.then(() => orgDependencies);
  //     });
  // }
}

export = OrgListMock;
