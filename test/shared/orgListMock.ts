/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as moment from 'moment';

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
    nonScratchOrgs: [
      {
        username: 'foo@example.com',
        isDevHub: true,
        connectedStatus: 'Connected',
      },
    ],
    devHubs: [
      {
        username: 'foo@example.com',
        isDevHub: true,
        connectedStatus: 'Connected',
      },
    ],
    sandboxes: [],
    other: [],
  };

  public static get devHubUsername(): string {
    return 'foo@example.com';
  }

  public static get testUsers(): string[] {
    return TEST_USERS;
  }

  public static get serverData(): Map<string, Record<string, unknown>> {
    return SERVER_DATA;
  }
}

export = OrgListMock;
