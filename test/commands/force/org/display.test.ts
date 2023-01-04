/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// import { AuthInfo } from '@salesforce/core';
// import { StubbedType } from '@salesforce/ts-sinon';
import { expect, config as chaiConfig } from 'chai';
// import { OrgDisplayReturn } from 'src/shared/orgTypes';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/core';
// import * as utils from '../../../../src/shared/utils';
import { Connection } from '@salesforce/core';
import { OrgListUtil } from '../../../../src/shared/orgListUtil';
import { OrgDisplayCommand } from '../../../../src/commands/force/org/display';

chaiConfig.truncateThreshold = 0;
// const baseAuthInfo = {
//   username: 'nonscratch@test.com',
//   orgId: '00D46000000biZIIEAQ',
//   accessToken:
//     '00D46000000biZI!ARwAQNgoMldHR6XvpaTWdlr_J_pNnXqlh.VNI3Oqwqh7rzEBq6j4s7_E9hXmiIi8WwZasFAXTZNLwfg1SyuJ4wPRQAu.bPi4',
//   instanceUrl: 'https://someinstance.my.salesforce.com',
//   loginUrl: 'https://login.salesforce.com',
//   clientId: 'PlatformCLI',
// };

// the same data, but with orgId renamed to id
// const baseExpected = {
//   ...baseAuthInfo,
//   loginUrl: undefined,
//   id: baseAuthInfo.orgId,
//   orgId: undefined,
// };

const refreshToken = '5Aep8616XE5JLxJp3EMunMMUzXg.Ye8T6EJDtnvz0aSok0TzLMkNbW7YRi99Yx85XLvz6zP44x_hVTl8pIW8S5_IW';

// const AssertBase = (result: OrgDisplayReturn) => {
//   for (const [key, value] of Object.entries(baseExpected)) {
//     expect(result).to.have.property(key, value);
//   }
//   return true;
// };

describe('org:display', () => {
  const $$ = new TestContext();
  let testOrg = new MockTestOrgData();

  beforeEach(() => {
    testOrg = new MockTestOrgData();
    testOrg.clientId = 'PlatformCLI';
  });
  afterEach(() => {
    $$.restore();
  });

  describe('stdout', () => {
    let stdoutSpy: sinon.SinonSpy;

    beforeEach(() => {
      stdoutSpy = $$.SANDBOX.spy(process.stdout, 'write');
    });
    afterEach(() => {
      $$.restore();
    });

    it('includes correct rows in non-json (table) mode with verbose', async () => {
      await $$.stubAuths(testOrg);
      $$.SANDBOX.stub(OrgListUtil, 'determineConnectedStatusForNonScratchOrg').resolves('Connected');

      const cmd = new OrgDisplayCommand(['--targetusername', testOrg.username, '--verbose'], {} as Config);
      await cmd.run();

      const stdoutResult = stdoutSpy.args.flat().join('');
      expect(stdoutResult).to.include('Sfdx Auth Url');
    });

    it('includes correct rows in non-json (table) mode', async () => {
      await $$.stubAuths(testOrg);
      $$.SANDBOX.stub(OrgListUtil, 'determineConnectedStatusForNonScratchOrg').resolves('Connected');

      const cmd = new OrgDisplayCommand(['--targetusername', testOrg.username], {} as Config);
      await cmd.run();

      const stdoutResult = stdoutSpy.args.flat().join('');
      // eslint-disable-next-line no-console
      console.log(stdoutResult);

      expect(stdoutResult).to.include('Connected Status');
      expect(stdoutResult).to.include('Access Token');
      expect(stdoutResult).to.include('Client Id');
      expect(stdoutResult).to.include('Instance Url');
      // not without verbose
      expect(stdoutResult).to.not.include('Sfdx Auth Url');
    });
  });

  it('gets an org from local auth files by username', async () => {
    testOrg.aliases = ['nonscratchalias'];
    $$.stubAliases({ nonscratchalias: testOrg.username });
    await $$.stubAuths(testOrg);

    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username], {} as Config);
    const result = await cmd.run();
    // expect(AssertBase(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
    expect(result.password).to.be.undefined;
    expect(result.expirationDate).to.be.undefined;
    expect(result.alias).to.equal('nonscratchalias');
  });

  it('gets an org from local auth files by alias', async () => {
    await $$.stubAuths(testOrg);
    $$.stubAliases({ nonscratchalias: testOrg.username });
    const cmd = new OrgDisplayCommand(['--json', '--targetusername', 'nonscratchalias'], {} as Config);
    const result = await cmd.run();
    // expect(AssertBase(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
    expect(result.alias).to.equal('nonscratchalias');
  });

  it('displays authUrl when using refresh token AND verbose', async () => {
    testOrg.refreshToken = refreshToken;
    await $$.stubAuths(testOrg);

    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username, '--verbose'], {} as Config);

    const result = await cmd.run();

    expect(result.sfdxAuthUrl).to.include(refreshToken);
  });

  it('omits authUrl when not using refresh token, despite verbose', async () => {
    await $$.stubAuths(testOrg);
    const cmd = new OrgDisplayCommand(['--json', '--targetusername', 'nonscratch@test.com', '--verbose'], {} as Config);

    const result = await cmd.run();
    // expect(AssertBase(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
  });

  it('omits authUrl when using refresh token without verbose', async () => {
    await $$.stubAuths(testOrg);
    const cmd = new OrgDisplayCommand(['--json', '--targetusername', 'nonscratch@test.com'], {} as Config);

    const result = await cmd.run();
    // expect(AssertBase(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
  });

  it("omits alias when alias doesn't exist for username", async () => {
    testOrg.aliases = [];
    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username], {} as Config);
    await $$.stubAuths(testOrg);

    const result = await cmd.run();
    expect(result.alias).to.be.undefined;
  });

  it('displays decrypted password if password exists', async () => {
    testOrg.password = 'encrypted';
    await $$.stubAuths(testOrg);

    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username], {} as Config);

    const result = await cmd.run();
    expect(result.password).to.equal('encrypted');
  });

  it('queries server for scratch org info', async () => {
    const testHub = new MockTestOrgData();
    testOrg.devHubUsername = testHub.username;
    await $$.stubAuths(testOrg, testHub);

    $$.SANDBOX.stub(Connection.prototype, 'sobject').returns({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // we all know this is not the full type
      find: async () => [
        {
          Status: 'Active',
          ExpirationDate: '2021-01-23',
          CreatedBy: { Username: testHub.username },
          Edition: 'Developer',
          OrgName: 'MyOrg',
          CreatedDate: '2020-12-24T15:18:55.000+0000',
        },
      ],
    });

    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username], {} as Config);
    const result = await cmd.run();
    expect(result).to.not.be.undefined;
    expect(result.status).to.equal('Active');
  });

  // it('gets non-scratch org connectedStatus');
  // it('handles properly when username is an accessToken?');
  // it('displays good error when org is not connectable due to DNS');
  // it('displays scratch-org-only properties for scratch orgs');
  // it('displays no scratch-org-only properties for non-scratch orgs');
});
