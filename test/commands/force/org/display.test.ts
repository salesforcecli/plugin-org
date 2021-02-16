/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect, test } from '@salesforce/command/lib/test';
import { Aliases, AuthInfo, Connection, Org } from '@salesforce/core';

import { stubMethod, stubInterface, StubbedType } from '@salesforce/ts-sinon';
import * as utils from '../../../../src/shared/utils';

const baseAuthInfo = {
  username: 'nonscratch@test.com',
  orgId: '00D46000000biZIIEAQ',
  accessToken:
    '00D46000000biZI!ARwAQNgoMldHR6XvpaTWdlr_J_pNnXqlh.VNI3Oqwqh7rzEBq6j4s7_E9hXmiIi8WwZasFAXTZNLwfg1SyuJ4wPRQAu.bPi4',
  instanceUrl: 'https://someinstance.my.salesforce.com',
  loginUrl: 'https://login.salesforce.com',
  clientId: 'PlatformCLI',
};

// the same data, but with orgId renamed to id
const baseExpected = {
  ...baseAuthInfo,
  loginUrl: undefined,
  id: baseAuthInfo.orgId,
  orgId: undefined,
};

const refreshToken = '5Aep8616XE5JLxJp3EMunMMUzXg.Ye8T6EJDtnvz0aSok0TzLMkNbW7YRi99Yx85XLvz6zP44x_hVTl8pIW8S5_IW';
const devHub = {
  username: 'dev@hub.test',
  id: 'hubId',
};

const AssertBase = (result) => {
  for (const key of Object.keys(baseExpected)) {
    expect(result[key]).to.equal(baseExpected[key]);
  }
  return true;
};

const fakeAuthUrl = 'fakeAuthUrl';

describe('org:display', () => {
  let authInfoStub: StubbedType<AuthInfo>;

  beforeEach(async function () {
    $$.SANDBOX.restore();
    stubMethod($$.SANDBOX, Aliases, 'fetch')
      .withArgs('nonscratchalias')
      .resolves('nonscratch@test.com')
      .withArgs('scratchAlias')
      .resolves('scratch@test.com');
    stubMethod($$.SANDBOX, utils, 'getAliasByUsername')
      .withArgs('nonscratch@test.com')
      .resolves('nonscratchalias')
      .withArgs('scratch@test.com')
      .resolves('scratch')
      .withArgs('username@noalias.test')
      .resolves(undefined);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function prepareStubs(AuthInfoModifications: any = {}) {
    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => ({
        ...baseAuthInfo,
        ...AuthInfoModifications,
      }),
      getSfdxAuthUrl: () => {
        if (AuthInfoModifications.refreshToken) {
          return fakeAuthUrl;
        }
        return 'badUrl';
      },
    });
    stubMethod($$.SANDBOX, AuthInfo, 'create').callsFake(async () => authInfoStub);
  }

  test
    .do(async () => {
      await prepareStubs();
    })
    .stdout()
    .command(['force:org:display', '--json', '--targetusername', 'nonscratch@test.com'])
    .it('gets an org from local auth files by username', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(AssertBase(result));
      expect(result.sfdxAuthUrl).to.be.undefined;
      expect(result.password).to.be.undefined;
      expect(result.expirationDate).to.be.undefined;
      expect(result.alias).to.equal('nonscratchalias');
    });

  test
    .do(async () => {
      await prepareStubs();
    })
    .stdout()
    .command(['force:org:display', '--json', '--targetusername', 'nonscratchalias'])
    .it('gets an org from local auth files by alias', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(AssertBase(result));
      expect(result.sfdxAuthUrl).to.be.undefined;
    });

  test
    .do(async () => {
      await prepareStubs({
        refreshToken,
      });
    })
    .stdout()
    .command(['force:org:display', '--json', '--targetusername', 'nonscratch@test.com', '--verbose'])
    .it('displays authUrl when using refresh token AND verbose', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(AssertBase(result));
      expect(result.sfdxAuthUrl).equal(fakeAuthUrl); // reusing existing method on AuthInfo--not verifying it works
    });

  test
    .do(async () => {
      await prepareStubs();
    })
    .stdout()
    .command(['force:org:display', '--json', '--targetusername', 'nonscratch@test.com', '--verbose'])
    .it('omits authUrl when not using refresh token, despite verbose', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(AssertBase(result));
      expect(result.sfdxAuthUrl).to.be.undefined;
    });

  test
    .do(async () => {
      await prepareStubs({
        refreshToken,
      });
    })
    .stdout()
    .command(['force:org:display', '--json', '--targetusername', 'nonscratch@test.com'])
    .it('omits authUrl when using refresh token without verbose', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(AssertBase(result));
      expect(result.sfdxAuthUrl).to.be.undefined;
    });

  test
    .do(async () => {
      await prepareStubs({});
    })
    .stdout()
    .command(['force:org:display', '--targetusername', 'nonscratch@test.com'])
    .it('includes correct rows in non-json (table) mode', (ctx) => {
      const result = ctx.stdout;
      expect(result).to.include('Access Token');
      expect(result).to.include('Connected Status');
      expect(result).to.include('Client Id');
      expect(result).to.include('Instance Url');
      // not without verbose
      expect(result).to.not.include('Sfdx Auth Url');
    });

  test
    .do(async () => {
      await prepareStubs({
        refreshToken,
      });
    })
    .stdout()
    .command(['force:org:display', '--targetusername', 'nonscratch@test.com', '--verbose'])
    .it('includes correct rows in non-json (table) mode with verbose', (ctx) => {
      const result = ctx.stdout;
      expect(result).to.include('Sfdx Auth Url');
    });

  test
    .do(async () => {
      await prepareStubs({
        username: 'username@noalias.test',
      });
    })
    .stdout()
    .command(['force:org:display', '--json', '--targetusername', 'noalias@test.com'])
    .it("omits alias when alias doesn't exist for username", (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(result.alias).to.be.undefined;
    });

  test
    .do(async () => {
      await prepareStubs({
        password: 'unEncrypted',
      });
    })
    .stdout()
    .command(['force:org:display', '--json', '--targetusername', 'nonscratch@test.com'])
    .it('displays decrypted password if password exists', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(result.password).to.equal('unEncrypted');
    });

  test
    .do(async () => {
      await prepareStubs({
        devHubUsername: devHub.username,
      });
      stubMethod($$.SANDBOX, Org, 'create').resolves(Org.prototype);
      stubMethod($$.SANDBOX, Org.prototype, 'getUsername').returns('scratch@test.com');

      stubMethod($$.SANDBOX, Org.prototype, 'getOrgId').resolves(devHub.id);
      stubMethod($$.SANDBOX, Org.prototype, 'getDevHubOrg').resolves({
        getUsername: () => devHub.username,
      });
      stubMethod($$.SANDBOX, Org.prototype, 'getConnection').returns(Connection.prototype);

      stubMethod($$.SANDBOX, Connection.prototype, 'sobject').returns({
        find: async () => {
          return [
            {
              Status: 'Active',
              ExpirationDate: '2021-01-23',
              CreatedBy: { Username: devHub.username },
              Edition: 'Developer',
              OrgName: 'MyOrg',
              CreatedDate: '2020-12-24T15:18:55.000+0000',
            },
          ];
        },
      });
    })
    .stdout()
    .command(['force:org:display', '--targetusername', 'scratch@test.com', '--json'])
    .it('queries server for scratch org info', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(result).to.not.be.undefined;
      expect(result.status).to.equal('Active');
    });

  it('gets non-scratch org connectedStatus');
  it('handles properly when username is an accessToken?');
  it('displays good error when org is not connectable due to DNS');
  it('displays scratch-org-only properties for scratch orgs');
  it('displays no scratch-org-only properties for non-scratch orgs');
});
