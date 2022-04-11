/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, test } from '@salesforce/command/lib/test';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';
import cli from 'cli-ux';

chai.use(chaiAsPromised);

import { AuthInfo, Connection, Org } from '@salesforce/core';
import { stubMethod, stubInterface } from '@salesforce/ts-sinon';

import OrgListMock = require('../../../shared/orgListMock');
import { OrgListUtil } from '../../../../src/shared/orgListUtil';

describe('org_list', () => {
  const sandbox = sinon.createSandbox();
  beforeEach(async () => {
    stubMethod(sandbox, AuthInfo, 'listAllAuthFiles');
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('hub org defined', () => {
    beforeEach(async () => {
      // await workspace.configureHubOrg();
      stubMethod(sandbox, OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').resolves(
        OrgListMock.AUTH_INFO
      );
    });

    afterEach(async () => {
      sandbox.restore();
    });

    test
      .stdout()
      .command(['force:org:list', '--json'])
      .it('should list active orgs', (ctx) => {
        const orgs = JSON.parse(ctx.stdout).result;
        expect(orgs.nonScratchOrgs.length).to.equal(1);
        expect(orgs.nonScratchOrgs[0].username).to.equal('foo@example.com');
        expect(orgs.nonScratchOrgs[0].isDevHub).to.equal(true);
        expect(orgs.scratchOrgs.length).to.equal(2); // there are two orgs non-expired
      });

    test
      .stdout()
      .command(['force:org:list', '--json', '--all'])
      .it('should list all orgs', (ctx) => {
        const orgs = JSON.parse(ctx.stdout).result;
        expect(orgs.scratchOrgs.length).to.equal(4); // there are 4 orgs total
      });
  });

  describe('scratch org cleaning', () => {
    const spies = new Map();
    afterEach(() => spies.clear());

    beforeEach(() => {
      sandbox.stub(OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').resolves(OrgListMock.AUTH_INFO);
      const authInfoStub = stubInterface<AuthInfo>(sandbox, {
        getConnectionOptions: () => ({}),
      });
      stubMethod(sandbox, Connection, 'create').resolves({});
      stubMethod(sandbox, AuthInfo, 'create').resolves(async () => authInfoStub);
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      spies.set('orgRemove', stubMethod(sandbox, Org.prototype, 'remove').resolves());
    });

    test
      .stub(cli, 'confirm', () => async () => false)
      .stdout()
      .command(['force:org:list', '--json', '--clean'])
      .it('not cleaned after confirmation false', async () => {
        expect(spies.get('orgRemove').callCount).to.equal(0);
      });

    test
      .stub(cli, 'confirm', () => async () => true)
      .stdout()
      .command(['force:org:list', '--json', '--clean'])
      .it('cleaned after confirmation true', async () => {
        expect(spies.get('orgRemove').callCount).to.equal(2); // there are 2 expired scratch orgs
      });
  });
});
