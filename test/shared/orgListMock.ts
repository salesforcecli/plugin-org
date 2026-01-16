/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import moment from 'moment';

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

export default class OrgListMock {
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
