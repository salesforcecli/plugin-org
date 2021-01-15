/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect } from '@salesforce/command/lib/test';

import { AuthInfo, ConfigAggregator, fs, Aliases } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { OrgListUtil } from '../../src/shared/orgListUtil';
import * as utils from '../../src/shared/utils';

const orgAuthConfigFields = {
  username: 'gaz@foo.org',
  expirationDate: '2099-03-30T00:00:00.000Z',
  devHubUsername: 'devhub@testOrg.com',
  accessToken: '123456abc',
  refreshToken: 'axb123',
  clientSecret: '123455',
};

const expiredAuthConfigFields = {
  username: 'test@foo.org',
  devHubUsername: 'devhub@testOrg.com',
  accessToken: '121abc',
  refreshToken: 'test123',
  clientSecret: '121',
};

const expiredAuthConfig = {
  getFields: () => expiredAuthConfigFields,
  getConnectionOptions: () => ({ accessToken: '00D!XX' }),
  isJwt: () => false,
  isOauth: () => false,
  getUsername: () => expiredAuthConfigFields.username,
};

const orgAuthConfig = {
  getFields: () => orgAuthConfigFields,
  getConnectionOptions: () => ({ accessToken: '00D!XX' }),
  isJwt: () => false,
  isOauth: () => false,
  getUsername: () => orgAuthConfigFields.username,
};

const devHubConfigFields = {
  username: 'foo@example.com',
  isDevHub: true,
};
const devHubConfig = {
  getFields: () => devHubConfigFields,
  getConnectionOptions: () => ({ accessToken: '00D!XX' }),
  isJwt: () => false,
  isOauth: () => false,
  getUsername: () => devHubConfigFields.username,
};
const fileNames = ['gaz@foo.org', 'test@org.com'];

describe('orgListUtil tests', () => {
  const spies = new Map();
  let readAuthFilesStub: sinon.SinonStub;
  let groupOrgsStub: sinon.SinonStub;
  let aliasListStub: sinon.SinonStub;
  let determineConnectedStatusForNonScratchOrg: sinon.SinonStub;
  let retrieveScratchOrgInfoFromDevHubStub: sinon.SinonStub;

  describe('readLocallyValidatedMetaConfigsGroupedByOrgType', () => {
    afterEach(() => spies.clear());

    beforeEach(() => {
      readAuthFilesStub = stubMethod($$.SANDBOX, OrgListUtil, 'readAuthFiles').resolves([
        orgAuthConfig,
        expiredAuthConfig,
        devHubConfig,
      ]);

      groupOrgsStub = stubMethod($$.SANDBOX, OrgListUtil, 'groupOrgs').resolves({
        nonScratchOrgs: [devHubConfigFields],
        scratchOrgs: [orgAuthConfigFields, expiredAuthConfigFields],
      });
      aliasListStub = stubMethod($$.SANDBOX, Aliases, 'fetch').resolves();
      determineConnectedStatusForNonScratchOrg = stubMethod(
        $$.SANDBOX,
        OrgListUtil,
        'determineConnectedStatusForNonScratchOrg'
      ).resolves({});
      retrieveScratchOrgInfoFromDevHubStub = stubMethod(
        $$.SANDBOX,
        OrgListUtil,
        'retrieveScratchOrgInfoFromDevHub'
      ).resolves([]);
      spies.set('reduceScratchOrgInfo', $$.SANDBOX.spy(OrgListUtil, 'reduceScratchOrgInfo'));

      $$.SANDBOX.stub(fs, 'readFileSync');
    });

    afterEach(async () => {
      $$.SANDBOX.restore();
    });

    it('readLocallyValidatedMetaConfigsGroupedByOrgType', async () => {
      const flags = {};
      await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
      expect(readAuthFilesStub.calledOnce).to.be.true;
      expect(groupOrgsStub.calledOnce).to.be.true;
      expect(aliasListStub.calledOnce).to.be.false;
      expect(determineConnectedStatusForNonScratchOrg.calledOnce).to.be.true;
      expect(retrieveScratchOrgInfoFromDevHubStub.calledOnce).to.be.true;
    });

    it('skipconnectionstatus', async () => {
      const flags = { skipconnectionstatus: true };
      await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
      expect(readAuthFilesStub.calledOnce).to.be.true;
      expect(groupOrgsStub.calledOnce).to.be.true;
      expect(aliasListStub.calledOnce).to.be.false;
      expect(determineConnectedStatusForNonScratchOrg.calledOnce).to.be.false;
    });

    it('should execute queries to check for org information if --verbose is used', async () => {
      const flags = { verbose: true };
      await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
      expect(retrieveScratchOrgInfoFromDevHubStub.calledOnce).to.be.true;
      expect(spies.get('reduceScratchOrgInfo').calledOnce).to.be.true;
    });

    it('execute queries should add information to grouped orgs', async () => {
      retrieveScratchOrgInfoFromDevHubStub.restore();
      retrieveScratchOrgInfoFromDevHubStub = stubMethod(
        $$.SANDBOX,
        OrgListUtil,
        'retrieveScratchOrgInfoFromDevHub'
      ).resolves([
        {
          SignupUsername: 'gaz@foo.org',
          OrgName: 'Baz',
          CreatedDate: '2017-04-11T17:58:43.000+0000',
          CreatedBy: 'SRV',
          Edition: 'Developer',
          ScratchOrg: '00Dxx0000001hcF',
          Status: 'Active',
        },
      ]);
      const flags = { verbose: true };
      const orgGroups = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
      expect(retrieveScratchOrgInfoFromDevHubStub.calledOnce).to.be.true;
      expect(spies.get('reduceScratchOrgInfo').calledOnce).to.be.true;
      expect(orgGroups.scratchOrgs[0].signupUsername).to.equal(orgAuthConfigFields.username);
    });
  });

  describe('groupOrgs', () => {
    let accum;
    let contents;

    beforeEach(() => {
      $$.SANDBOX.stub(AuthInfo, 'create');
      $$.SANDBOX.stub(utils, 'getAliasByUsername').withArgs('gaz@foo.org').resolves('gaz');
      readAuthFilesStub = stubMethod($$.SANDBOX, OrgListUtil, 'readAuthFiles').resolves([
        orgAuthConfig,
        expiredAuthConfig,
        devHubConfig,
      ]);
      stubMethod($$.SANDBOX, fs, 'stat').resolves({ atime: 'test' });
      stubMethod($$.SANDBOX, ConfigAggregator, 'create').resolves({
        getConfig: () => {
          return {
            defaultusername: orgAuthConfigFields.username,
            defaultdevhubusername: devHubConfigFields.username,
          };
        },
      });
      accum = {
        nonScratchOrgs: [],
        scratchOrgs: [],
      };
    });

    afterEach(async () => {
      $$.SANDBOX.restore();
    });

    it('ensure the auth infos are categorized into scratchOrgs, nonScratchOrgs', async () => {
      contents = await OrgListUtil.readAuthFiles(['gaz@foo.org']);
      const orgs = await OrgListUtil.groupOrgs(contents, accum);
      expect(orgs.scratchOrgs.length).to.equal(2);
      expect(orgs.scratchOrgs[0]).to.haveOwnProperty('username').to.equal('gaz@foo.org');
      expect(orgs.nonScratchOrgs.length).to.equal(1);
    });

    it('should omit sensitive information and catergorise active and non-active scracth orgs', async () => {
      const authInfos = await OrgListUtil.readAuthFiles(['gaz@foo.org']);
      const orgs = await OrgListUtil.groupOrgs(authInfos, accum);
      expect(orgs.scratchOrgs[0]).to.not.haveOwnProperty('clientSecret');
      expect(orgs.scratchOrgs[1]).to.not.haveOwnProperty('clientSecret');
      expect(orgs.scratchOrgs[0]).to.not.haveOwnProperty('refreshToken');
      expect(orgs.scratchOrgs[1]).to.not.haveOwnProperty('refreshToken');
    });
  });
});
