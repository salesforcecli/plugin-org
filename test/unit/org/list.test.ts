/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
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
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    // Stub the ux methods on SfCommand so that you don't get any command output in your tests.
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
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

  describe('secret redaction warnings', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').resolves(
        OrgListMock.AUTH_INFO
      );
    });

    it('emits the workaround warning referencing sf org list when --json is used', async () => {
      await OrgListCommand.run(['--json']);
      const warnCalls = sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args);
      expect(warnCalls.some((w) => typeof w === 'string' && w.includes('sf org list'))).to.be.true;
      expect(warnCalls.some((w) => typeof w === 'string' && w.includes('SF_TEMP_SHOW_SECRETS'))).to.be.true;
      expect(warnCalls.some((w) => typeof w === 'string' && w.includes('sf org auth show-*'))).to.be.true;
    });

    it('does not emit the secrets warning without --json', async () => {
      await OrgListCommand.run([]);
      const warnCalls = sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args);
      expect(warnCalls.some((w) => typeof w === 'string' && w.includes('SF_TEMP_SHOW_SECRETS'))).to.be.false;
    });
  });

  describe('secret redaction warnings WITH env var (SF_TEMP_SHOW_SECRETS)', () => {
    const SHOW_TOKENS_ENV = 'SF_TEMP_SHOW_SECRETS';

    beforeEach(() => {
      process.env[SHOW_TOKENS_ENV] = 'true';
      stubMethod($$.SANDBOX, OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').resolves(
        OrgListMock.AUTH_INFO
      );
    });

    afterEach(() => {
      delete process.env[SHOW_TOKENS_ENV];
    });

    it('emits the deprecation warning referencing sf org list when --json is used', async () => {
      await OrgListCommand.run(['--json']);
      const warnCalls = sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args);
      expect(warnCalls.some((w) => typeof w === 'string' && w.includes('will be removed'))).to.be.true;
      expect(warnCalls.some((w) => typeof w === 'string' && w.includes('sf org list'))).to.be.true;
      expect(warnCalls.some((w) => typeof w === 'string' && w.includes('sf org auth show-*'))).to.be.true;
    });
  });
});
