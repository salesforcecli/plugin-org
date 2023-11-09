/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/lib/testSetup.js';
import { AuthInfo, Connection, Org } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { SfCommand, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import OrgListMock from '../../shared/orgListMock.js';
import { OrgListCommand } from '../../../src/commands/org/list.js';
import { OrgListUtil } from '../../../src/shared/orgListUtil.js';

describe('org:list', () => {
  // Create new TestContext, which automatically creates and restores stubs
  // pertaining to authorization, orgs, config files, etc...
  // There is no need to call $$.restore() in afterEach() since that is
  // done automatically by the TestContext.
  const $$ = new TestContext();

  beforeEach(() => {
    // Stub the ux methods on SfCommand so that you don't get any command output in your tests.
    stubSfCommandUx($$.SANDBOX);
    stubMethod($$.SANDBOX, AuthInfo, 'listAllAuthorizations').resolves([
      'Jimi Hendrix',
      'SRV',
      'shenderson',
      'SRV',
      'foo@example.com',
    ]);
  });

  describe('hub org defined', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').resolves(
        OrgListMock.AUTH_INFO
      );
    });

    it('should list active orgs', async () => {
      const orgs = await OrgListCommand.run(['--json']);
      expect(orgs.nonScratchOrgs.length).to.equal(1);
      expect(orgs.nonScratchOrgs[0].username).to.equal('foo@example.com');
      expect(orgs.nonScratchOrgs[0].isDevHub).to.equal(true);
      expect(orgs.scratchOrgs.length).to.equal(2); // there are two orgs non-expired
    });

    it('should list all orgs', async () => {
      const orgs = await OrgListCommand.run(['--json', '--all']);

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
      await OrgListCommand.run(['--json', '--clean', '--noprompt']);
      expect(spies.get('orgRemove').callCount).to.equal(2); // there are 2 expired scratch orgs
    });
  });
});
