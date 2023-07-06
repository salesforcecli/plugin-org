/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs/promises';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { AuthInfo, ConfigAggregator, Org } from '@salesforce/core';
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
  orgId: '00Dxx0000000000',
};

const orgScratchOrgInfo = {
  SignupUsername: orgAuthConfigFields.username,
  OrgName: 'Baz',
  CreatedDate: '2017-04-11T17:58:43.000+0000',
  CreatedBy: 'SRV',
  Edition: 'Developer',
  ScratchOrg: orgAuthConfigFields.orgId,
  Status: 'Active',
};

const expiredAuthConfigFields = {
  username: 'test@foo.org',
  expirationDate: '2019-03-30T00:00:00.000Z',
  devHubUsername: 'devhub@testOrg.com',
  accessToken: '121abc',
  refreshToken: 'test123',
  clientSecret: '121',
  orgId: '00Dxx0000000001',
};

const expiredOrgScratchOrgInfo = {
  SignupUsername: expiredAuthConfigFields.username,
  OrgName: 'Baz',
  CreatedDate: '2017-04-11T17:58:43.000+0000',
  CreatedBy: 'SRV',
  Edition: 'Developer',
  ScratchOrg: expiredAuthConfigFields.orgId,
  Status: 'Expired',
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
  orgId: '00Dxx0000000002',
  isDevHub: false, // we want to simulate updating this as part of the flow
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
  let determineConnectedStatusForNonScratchOrg: sinon.SinonStub;
  let retrieveScratchOrgInfoFromDevHubStub: sinon.SinonStub;
  let checkNonScratchOrgIsDevHub: sinon.SinonStub;
  const sandbox = sinon.createSandbox();

  describe('readLocallyValidatedMetaConfigsGroupedByOrgType', () => {
    afterEach(() => spies.clear());

    beforeEach(() => {
      sandbox.stub(AuthInfo, 'create');

      stubMethod(sandbox, OrgListUtil, 'readAuthFiles').resolves([orgAuthConfig, expiredAuthConfig, devHubConfig]);
      determineConnectedStatusForNonScratchOrg = stubMethod(
        sandbox,
        OrgListUtil,
        'determineConnectedStatusForNonScratchOrg'
      ).resolves('Connected');
      retrieveScratchOrgInfoFromDevHubStub = stubMethod(
        sandbox,
        OrgListUtil,
        'retrieveScratchOrgInfoFromDevHub'
      ).resolves([orgScratchOrgInfo, expiredOrgScratchOrgInfo]);
      checkNonScratchOrgIsDevHub = stubMethod(sandbox, OrgListUtil, 'checkNonScratchOrgIsDevHub').resolves(true);

      spies.set('reduceScratchOrgInfo', sandbox.spy(OrgListUtil, 'reduceScratchOrgInfo'));
      stubMethod(sandbox, ConfigAggregator, 'create').resolves({
        getConfig: () => ({
          defaultusername: orgAuthConfigFields.username,
          defaultdevhubusername: devHubConfigFields.username,
        }),
        getPropertyValue: () => {},
      });

      stubMethod(sandbox, fs, 'stat').resolves({ atime: 'test' });

      sandbox.stub(utils, 'getAliasByUsername').withArgs('gaz@foo.org').resolves('gaz');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('readLocallyValidatedMetaConfigsGroupedByOrgType', async () => {
      const flags = {};
      const orgs = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
      expect(orgs.nonScratchOrgs.every((nonScratchOrg) => nonScratchOrg.connectedStatus !== undefined)).to.be.true;
      expect(orgs.scratchOrgs.length).to.equal(2);
      expect(orgs.scratchOrgs[0]).to.haveOwnProperty('username').to.equal('gaz@foo.org');
      expect(orgs.nonScratchOrgs.length).to.equal(1);

      // devhub is updated to be true
      expect(checkNonScratchOrgIsDevHub.called).to.be.true;
      expect(orgs.nonScratchOrgs[0].isDevHub).to.be.true;
      expect(determineConnectedStatusForNonScratchOrg.calledOnce).to.be.true;
      expect(retrieveScratchOrgInfoFromDevHubStub.calledOnce).to.be.true;
    });

    it('skipconnectionstatus', async () => {
      const flags = { skipconnectionstatus: true };
      const orgs = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);

      // we didn't check the status, so the hub is still not known to be a devhub
      expect(orgs.nonScratchOrgs[0].isDevHub).to.be.false;
      expect(checkNonScratchOrgIsDevHub.called).to.be.false;

      expect(orgs.nonScratchOrgs.every((nonScratchOrg) => nonScratchOrg.connectedStatus === undefined)).to.be.true;

      expect(determineConnectedStatusForNonScratchOrg.called).to.be.false;
    });

    it('should omit sensitive information and catergorise active and non-active scracth orgs', async () => {
      const flags = {};
      const orgs = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);

      expect(orgs.scratchOrgs[0]).to.not.haveOwnProperty('clientSecret');
      expect(orgs.scratchOrgs[1]).to.not.haveOwnProperty('clientSecret');
      expect(orgs.scratchOrgs[0]).to.not.haveOwnProperty('refreshToken');
      expect(orgs.scratchOrgs[1]).to.not.haveOwnProperty('refreshToken');
    });

    it('should execute queries to check for org information if --verbose is used', async () => {
      const flags = { verbose: true };
      await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
      expect(retrieveScratchOrgInfoFromDevHubStub.calledOnce).to.be.true;
      expect(spies.get('reduceScratchOrgInfo').calledOnce).to.be.true;
    });

    it('execute queries should add information to grouped orgs', async () => {
      const flags = { verbose: true };
      const orgGroups = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, flags);
      expect(retrieveScratchOrgInfoFromDevHubStub.calledOnce).to.be.true;
      expect(spies.get('reduceScratchOrgInfo').calledOnce).to.be.true;
      expect(orgGroups.scratchOrgs[0].signupUsername).to.equal(orgAuthConfigFields.username);
      expect(orgGroups.scratchOrgs[0]).to.include.keys([
        'signupUsername',
        'createdBy',
        'createdDate',
        'devHubOrgId',
        'orgName',
        'edition',
        'status',
        'expirationDate',
        'isExpired',
      ]);
    });

    it('handles connection errors for non-scratch orgs', async () => {
      determineConnectedStatusForNonScratchOrg.restore();
      stubMethod(sandbox, Org, 'create').returns(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'getField').returns(undefined);
      stubMethod(sandbox, Org.prototype, 'getUsername').returns(devHubConfigFields.username);
      stubMethod(sandbox, Org.prototype, 'refreshAuth').rejects({ message: 'bad auth' });

      const orgGroups = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, {});
      expect(orgGroups.nonScratchOrgs).to.have.length(1);
      expect(orgGroups.nonScratchOrgs[0].connectedStatus).to.equal('bad auth');
      expect(checkNonScratchOrgIsDevHub.called).to.be.false;
    });

    it('handles auth file problems for non-scratch orgs', async () => {
      determineConnectedStatusForNonScratchOrg.restore();
      stubMethod(sandbox, Org, 'create').rejects({ message: 'bad file' });

      const orgGroups = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, {});
      expect(orgGroups.nonScratchOrgs).to.have.length(1);
      expect(orgGroups.nonScratchOrgs[0].connectedStatus).to.equal('bad file');
      expect(checkNonScratchOrgIsDevHub.called).to.be.false;
    });
  });

  describe('auth file reading tests', () => {
    // mock reading 2 org files
    beforeEach(() => {
      stubMethod(sandbox, fs, 'readdir').resolves(['00D000000000000001.json', '00D000000000000002.json']);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('will return an org with userId without an org file', async () => {
      stubMethod(sandbox, AuthInfo, 'create').resolves({
        getFields: () => ({ ...orgAuthConfigFields, userId: '005xxxxxxxxxxxxx', orgId: '00D000000000000003' }),
        getConnectionOptions: () => ({ accessToken: orgAuthConfigFields.accessToken }),
        isJwt: () => false,
        isOauth: () => false,
        getUsername: () => orgAuthConfigFields.username,
      });
      const authFiles = await OrgListUtil.readAuthFiles([`${orgAuthConfigFields.username}.json`]);
      expect(authFiles.length).to.equal(1);
      expect(authFiles[0].getFields()).to.have.property('username').equals(orgAuthConfigFields.username);
    });

    it('will return an org with userId with an org file where the userid is primary', async () => {
      stubMethod(sandbox, AuthInfo, 'create').resolves({
        getFields: () => ({ ...orgAuthConfigFields, userId: '005xxxxxxxxxxxxx', orgId: '00D000000000000001' }),
        getConnectionOptions: () => ({ accessToken: orgAuthConfigFields.accessToken }),
        isJwt: () => false,
        isOauth: () => false,
        getUsername: () => orgAuthConfigFields.username,
      });
      stubMethod(sandbox, fs, 'readFile').resolves(
        JSON.stringify({
          usernames: [orgAuthConfigFields.username, 'secondary@user.test'],
        })
      );
      const authFiles = await OrgListUtil.readAuthFiles([`${orgAuthConfigFields.username}.json`]);
      expect(authFiles.length).to.equal(1);
      expect(authFiles[0].getFields()).to.have.property('username').equals(orgAuthConfigFields.username);
    });

    it('will NOT return an org with userId with an org file where the userid is NOT listed', async () => {
      stubMethod(sandbox, AuthInfo, 'create').resolves({
        getFields: () => ({ ...orgAuthConfigFields, userId: '005xxxxxxxxxxxxx', orgId: '00D000000000000001' }),
        getConnectionOptions: () => ({ accessToken: orgAuthConfigFields.accessToken }),
        isJwt: () => false,
        isOauth: () => false,
        getUsername: () => orgAuthConfigFields.username,
      });
      stubMethod(sandbox, fs, 'readFile').resolves('{"usernames":["secondary@user.test"]}');
      const authFiles = await OrgListUtil.readAuthFiles([`${orgAuthConfigFields.username}.json`]);
      expect(authFiles.length).to.equal(0);
    });

    it('will NOT return an org with userId with an org file where the userid is listed but not first', async () => {
      stubMethod(sandbox, AuthInfo, 'create').resolves({
        getFields: () => ({ ...orgAuthConfigFields, userId: '005xxxxxxxxxxxxx', orgId: '00D000000000000001' }),
        getConnectionOptions: () => ({ accessToken: orgAuthConfigFields.accessToken }),
        isJwt: () => false,
        isOauth: () => false,
        getUsername: () => orgAuthConfigFields.username,
      });
      stubMethod(sandbox, fs, 'readFile').resolves(
        JSON.stringify({
          usernames: ['secondary@user.test', orgAuthConfigFields.username],
        })
      );
      const authFiles = await OrgListUtil.readAuthFiles([`${orgAuthConfigFields.username}.json`]);
      expect(authFiles.length).to.equal(0);
    });
  });
});
