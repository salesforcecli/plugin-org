/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, use as ChaiUse } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { TestContext } from '@salesforce/core/lib/testSetup';
import { AuthInfo, Connection, Org } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { Config } from '@oclif/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import OrgListMock = require('../../shared/orgListMock');
import { OrgListCommand } from '../../../src/commands/org/list';
import { OrgListUtil } from '../../../src/shared/orgListUtil';

ChaiUse(chaiAsPromised);

describe('org_list', () => {
  const $$ = new TestContext();

  beforeEach(async () => {
    stubMethod($$.SANDBOX, AuthInfo, 'listAllAuthorizations').resolves([
      'Jimi Hendrix',
      'SRV',
      'shenderson',
      'SRV',
      'foo@example.com',
    ]);
  });
  afterEach(() => {
    $$.SANDBOX.restore();
  });

  describe('hub org defined', () => {
    beforeEach(async () => {
      stubMethod($$.SANDBOX, OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').resolves(
        OrgListMock.AUTH_INFO
      );
    });

    afterEach(async () => {
      $$.SANDBOX.restore();
    });

    it('should list active orgs', async () => {
      const cmd = new OrgListCommand(['--json'], {} as Config);
      const orgs = await cmd.run();
      expect(orgs.nonScratchOrgs.length).to.equal(1);
      expect(orgs.nonScratchOrgs[0].username).to.equal('foo@example.com');
      expect(orgs.nonScratchOrgs[0].isDevHub).to.equal(true);
      expect(orgs.scratchOrgs.length).to.equal(2); // there are two orgs non-expired
    });

    it('should list all orgs', async () => {
      const cmd = new OrgListCommand(['--json', '--all'], {} as Config);
      const orgs = await cmd.run();

      expect(orgs.scratchOrgs.length).to.equal(4); // there are 4 orgs total
    });
  });

  describe('scratch org cleaning', () => {
    const spies = new Map();
    afterEach(() => spies.clear());

    beforeEach(() => {
      stubMethod($$.SANDBOX, Org, 'create').resolves(Org.prototype);
      stubMethod($$.SANDBOX, AuthInfo, 'create').resolves(AuthInfo.prototype);
      stubMethod($$.SANDBOX, Connection, 'create').resolves(Connection.prototype);
      stubMethod($$.SANDBOX, OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').resolves(
        OrgListMock.AUTH_INFO
      );
      spies.set('orgRemove', stubMethod($$.SANDBOX, Org.prototype, 'remove').resolves());
    });

    it('not cleaned after confirmation false', async () => {
      const promptStub = $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);
      await OrgListCommand.run(['--json', '--clean']);
      expect(promptStub.callCount).to.equal(1);
      expect(spies.get('orgRemove').callCount).to.equal(0);
    });

    it('cleans 2 orgs', async () => {
      await OrgListCommand.run(['--clean', '--noprompt']);
      expect(spies.get('orgRemove').callCount).to.equal(2); // there are 2 expired scratch orgs
    });

    it('cleans 2 orgs', async () => {
      const cmd = new OrgListCommand(['--json', '--clean', '--noprompt'], {} as Config);
      await cmd.run();
      expect(spies.get('orgRemove').callCount).to.equal(2); // there are 2 expired scratch orgs
    });
  });
});
