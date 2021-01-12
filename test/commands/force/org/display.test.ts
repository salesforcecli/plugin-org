/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect, test } from '@salesforce/command/lib/test';
import { Aliases, AuthInfo } from '@salesforce/core';
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

// the same data, but with orgId renamed
const baseExpected = {
  ...baseAuthInfo,
  loginUrl: undefined,
  id: baseAuthInfo.orgId,
  orgId: undefined,
};

const refreshToken = '5Aep8616XE5JLxJp3EMunMMUzXg.Ye8T6EJDtnvz0aSok0TzLMkNbW7YRi99Yx85XLvz6zP44x_hVTl8pIW8S5_IW';

const AssertBase = (result) => {
  for (const key of Object.keys(baseExpected)) {
    expect(result[key]).to.equal(baseExpected[key]);
  }
  return true;
};

describe('org:display', () => {
  let authInfoStub: StubbedType<AuthInfo>;

  beforeEach(async function () {
    stubMethod($$.SANDBOX, Aliases, 'fetch').withArgs('nonscratchalias').resolves('nonscratch@test.com');
    stubMethod($$.SANDBOX, utils, 'getAliasByUsername')
      .withArgs('nonscratch@test.com')
      .resolves('nonscratchalias')
      .withArgs('username@noalias.test')
      .resolves(undefined);
  });

  async function prepareStubs(AuthInfoModifications = {}) {
    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => ({
        ...baseAuthInfo,
        ...AuthInfoModifications,
      }),
      getConnectionOptions: () => ({ accessToken: baseAuthInfo.accessToken }),
      isJwt: () => false,
      isOauth: () => true,
      getSfdxAuthUrl: () => 'fakeAuthUrl',
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
      expect(result.sfdxAuthUrl).equal('fakeAuthUrl'); // reusing existing method on AuthInfo--not verifying it works
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
        password: 'unEcrypted',
      });
    })
    .stdout()
    .command(['force:org:display', '--json', '--targetusername', 'nonscratch@test.com'])
    .it('displays decrypted password if password exists', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      expect(result.password).to.equal('unEcrypted');
    });

  it('gets non-scratch org connectedStatus');
  it('makes a nice output table');
  it('throws when username is an accessToken?');
  it('displays good error when org is not connectable due to DNS');
  it('displays scratch-org-only properties for scratch orgs');
  it('displays no scratch-org-only properties for non-scratch orgs');
});
