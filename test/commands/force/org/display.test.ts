/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, config as chaiConfig } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/core';
import { Connection } from '@salesforce/core';
import { OrgDisplayReturn } from '../../../../src/shared/orgTypes';
import { OrgListUtil } from '../../../../src/shared/orgListUtil';
import { OrgDisplayCommand } from '../../../../src/commands/force/org/display';

chaiConfig.truncateThreshold = 0;

const refreshToken = '5Aep8616XE5JLxJp3EMunMMUzXg.Ye8T6EJDtnvz0aSok0TzLMkNbW7YRi99Yx85XLvz6zP44x_hVTl8pIW8S5_IW';

describe('org:display', () => {
  const $$ = new TestContext();
  let testOrg = new MockTestOrgData();

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
  });
  afterEach(() => {
    $$.restore();
  });

  describe('stdout', () => {
    let stdoutSpy: sinon.SinonSpy;

    beforeEach(() => {
      stdoutSpy = $$.SANDBOX.stub(process.stdout, 'write');
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
      expect(stdoutResult).to.include('Client Id');
    });

    it('includes correct rows in non-json (table) mode', async () => {
      await $$.stubAuths(testOrg);
      $$.SANDBOX.stub(OrgListUtil, 'determineConnectedStatusForNonScratchOrg').resolves('Connected');

      const cmd = new OrgDisplayCommand(['--targetusername', testOrg.username], {} as Config);
      await cmd.run();

      const stdoutResult = stdoutSpy.args.flat().join('');

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
    expect(commonAssert(result));
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
    // expect(commonAssert(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
    expect(result.alias).to.equal('nonscratchalias');
  });

  it('displays authUrl when using refresh token AND verbose', async () => {
    testOrg.refreshToken = refreshToken;
    await $$.stubAuths(testOrg);

    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username, '--verbose'], {} as Config);

    const result = await cmd.run();

    expect(result.sfdxAuthUrl).to.include(testOrg.refreshToken);
  });

  it('omits authUrl when not using refresh token, despite verbose', async () => {
    testOrg.refreshToken = undefined;
    await $$.stubAuths(testOrg);
    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username, '--verbose'], {} as Config);

    const result = await cmd.run();
    expect(commonAssert(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
  });

  it('omits authUrl when using refresh token without verbose', async () => {
    await $$.stubAuths(testOrg);
    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username], {} as Config);

    const result = await cmd.run();
    expect(commonAssert(result));
    expect(result.sfdxAuthUrl).to.be.undefined;
  });

  it("omits alias when alias doesn't exist for username", async () => {
    testOrg.aliases = [];
    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username], {} as Config);
    await $$.stubAuths(testOrg);

    const result = await cmd.run();
    expect(commonAssert(result));
    expect(result.alias).to.be.undefined;
  });

  it('displays decrypted password if password exists', async () => {
    testOrg.password = 'encrypted';
    await $$.stubAuths(testOrg);

    const cmd = new OrgDisplayCommand(['--json', '--targetusername', testOrg.username], {} as Config);

    const result = await cmd.run();
    expect(commonAssert(result));
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
