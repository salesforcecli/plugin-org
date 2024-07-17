/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, config as chaiConfig } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { Connection } from '@salesforce/core';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { OrgDisplayCommand } from '../../../src/commands/org/display.js';
import { OrgListUtil } from '../../../src/shared/orgListUtil.js';
import { OrgDisplayReturn } from '../../../src/shared/orgTypes.js';

chaiConfig.truncateThreshold = 0;

const refreshToken = '5Aep8616XE5JLxJp3EMunMMUzXg.Ye8T6EJDtnvz0aSok0TzLMkNbW7YRi99Yx85XLvz6zP44x_hVTl8pIW8S5_IW';

describe('org:display', () => {
  // Create new TestContext, which automatically creates and restores stubs
  // pertaining to authorization, orgs, config files, etc...
  // There is no need to call $$.restore() in afterEach() since that is
  // done automatically by the TestContext.
  const $$ = new TestContext();
  let testOrg = new MockTestOrgData();
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  const commonAssert = (result: OrgDisplayReturn) => {
    expect(result).to.have.property('username', testOrg.username);
    expect(result).to.have.property('id', testOrg.orgId);
    expect(result).to.have.property('accessToken', testOrg.accessToken);
    expect(result).to.have.property('instanceUrl', testOrg.instanceUrl);
    expect(result).to.have.property('clientId', testOrg.clientId);
  };

  beforeEach(() => {
    testOrg = new MockTestOrgData();
    testOrg.orgId = '00Dxx0000000000';
    // Stub the ux methods on SfCommand so that you don't get any command output in your tests.
    // You can also make assertions on the ux methods to ensure that they are called with the
    // correct arguments.
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
  });

  describe('stdout', () => {
    it('includes correct rows in non-json (table) mode with verbose', async () => {
      await $$.stubAuths(testOrg);
      $$.SANDBOX.stub(OrgListUtil, 'determineConnectedStatusForNonScratchOrg').resolves('Connected');

      await OrgDisplayCommand.run(['--targetusername', testOrg.username, '--verbose']);
      const data = sfCommandUxStubs.table.firstCall.args[0];
      expect(data).to.deep.include({
        key: 'Client Id',
        value: testOrg.clientId,
      });

      const authUrl = data.find((row) => row.key === 'Sfdx Auth Url');
      expect(authUrl).to.exist;
      expect(authUrl?.value).to.include(testOrg.clientId);
    });

    it('includes correct rows in non-json (table) mode', async () => {
      await $$.stubAuths(testOrg);
      $$.SANDBOX.stub(OrgListUtil, 'determineConnectedStatusForNonScratchOrg').resolves('Connected');

      await OrgDisplayCommand.run(['--targetusername', testOrg.username]);

      const columns = sfCommandUxStubs.table.firstCall.args[0].flatMap((row) => row.key);

      expect(columns).to.include('Connected Status');
      expect(columns).to.include('Access Token');
      expect(columns).to.include('Client Id');
      expect(columns).to.include('Instance Url');
      // not without verbose
      expect(columns).to.not.include('Sfdx Auth Url');
    });
  });

  it('gets an org from local auth files by username', async () => {
    testOrg.aliases = ['nonscratchalias'];
    $$.stubAliases({ nonscratchalias: testOrg.username });
    await $$.stubAuths(testOrg);

    const result = await OrgDisplayCommand.run(['--json', '--targetusername', testOrg.username]);
    expect(commonAssert(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
    expect(result.password).to.be.undefined;
    expect(result.expirationDate).to.be.undefined;
    expect(result.alias).to.equal('nonscratchalias');
  });

  it('gets the correct org if multiple scratch org records are found', async () => {
    const testHub = new MockTestOrgData();
    testOrg.devHubUsername = testHub.username;
    testOrg.isScratchOrg = true;

    await $$.stubAuths(testOrg, testHub);

    $$.SANDBOX.stub(OrgListUtil, 'retrieveScratchOrgInfoFromDevHub').resolves([
      {
        CreatedDate: '2024-06-15T05:52:42.000+0000',
        Edition: 'Developer',
        Status: 'Deleted',
        ExpirationDate: '2024-06-16',
        Namespace: 'null',
        OrgName: 'ACME',
        CreatedBy: {
          Username: 'admin@integrationtesthubna40.org',
        },
        Username: 'johndoe@hi.com',
        SignupUsername: 'johndoe@hi.com',
        devHubOrgId: testHub.orgId,
      },
      {
        CreatedDate: '2024-06-16T05:52:42.000+0000',
        Edition: 'Developer',
        Status: 'Active',
        ExpirationDate: '2024-06-17',
        Namespace: 'null',
        OrgName: 'Dreamhouse',
        CreatedBy: {
          Username: testHub.username,
        },
        Username: testOrg.username,
        SignupUsername: testOrg.username,
        devHubOrgId: testHub.orgId,
      },
    ]);
    const result = await OrgDisplayCommand.run(['--targetusername', testOrg.username]);
    expect(commonAssert(result));
    // check specifically `orgName` because it's one of the fields that comes from the payload instead of the auth file
    expect(result.orgName).to.equal('Dreamhouse');
  });

  it('gets an org from local auth files by alias', async () => {
    await $$.stubAuths(testOrg);
    $$.stubAliases({ nonscratchalias: testOrg.username });
    const result = await OrgDisplayCommand.run(['--json', '--targetusername', 'nonscratchalias']);
    // expect(commonAssert(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
    expect(result.alias).to.equal('nonscratchalias');
  });

  it('displays authUrl when using refresh token AND verbose', async () => {
    testOrg.refreshToken = refreshToken;
    await $$.stubAuths(testOrg);

    const result = await OrgDisplayCommand.run(['--json', '--targetusername', testOrg.username, '--verbose']);
    expect(result.sfdxAuthUrl).to.include(testOrg.refreshToken);
  });

  it('omits authUrl when not using refresh token, despite verbose', async () => {
    testOrg.refreshToken = undefined;
    await $$.stubAuths(testOrg);
    const result = await OrgDisplayCommand.run(['--json', '--targetusername', testOrg.username, '--verbose']);

    expect(commonAssert(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
  });

  it('omits authUrl when using refresh token without verbose', async () => {
    await $$.stubAuths(testOrg);
    const result = await OrgDisplayCommand.run(['--json', '--targetusername', testOrg.username]);

    expect(commonAssert(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
  });

  it("omits alias when alias doesn't exist for username", async () => {
    testOrg.aliases = [];
    await $$.stubAuths(testOrg);

    const result = await OrgDisplayCommand.run(['--json', '--targetusername', testOrg.username]);
    expect(commonAssert(result));
    expect(result.alias).to.be.undefined;
  });

  it('displays decrypted password if password exists', async () => {
    testOrg.password = 'encrypted';
    await $$.stubAuths(testOrg);

    const result = await OrgDisplayCommand.run(['--json', '--targetusername', testOrg.username]);
    expect(commonAssert(result));
    expect(result.password).to.equal('encrypted');
  });

  it('queries server for scratch org info', async () => {
    const testHub = new MockTestOrgData();
    testOrg.devHubUsername = testHub.username;
    await $$.stubAuths(testOrg, testHub);

    $$.SANDBOX.stub(Connection.prototype, 'sobject').returns({
      find: async () =>
        // @ts-expect-error we all know this is not the full type
        Promise.resolve([
          {
            Status: 'Active',
            ExpirationDate: '2021-01-23',
            CreatedBy: { Username: testHub.username },
            Edition: 'Developer',
            OrgName: 'MyOrg',
            CreatedDate: '2020-12-24T15:18:55.000+0000',
            SignupUsername: testOrg.username,
          },
        ]),
    });

    const result = await OrgDisplayCommand.run(['--json', '--targetusername', testOrg.username]);
    expect(result).to.not.be.undefined;
    expect(result.status).to.equal('Active');
  });

  // it('gets non-scratch org connectedStatus');
  // it('handles properly when username is an accessToken?');
  // it('displays good error when org is not connectable due to DNS');
  // it('displays scratch-org-only properties for scratch orgs');
  // it('displays no scratch-org-only properties for non-scratch orgs');
});
