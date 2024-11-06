/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Messages, Org, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { SinonStub } from 'sinon';
import { config, expect } from 'chai';
import { stubPrompter, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { SandboxAccessor } from '../../../node_modules/@salesforce/core/lib/stateAggregator/accessors/sandboxAccessor.js';
import DeleteSandbox from '../../../src/commands/org/delete/sandbox.js';
import DeleteScratch from '../../../src/commands/org/delete/scratch.js';

config.truncateThreshold = 0;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const sbxOrgMessages = Messages.loadMessages('@salesforce/plugin-org', 'delete_sandbox');
const scratchOrgMessages = Messages.loadMessages('@salesforce/plugin-org', 'delete_scratch');

describe('org delete', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const testHub = new MockTestOrgData();
  testOrg.devHubUsername = testHub.username;
  // stubs
  let prompterStubs: ReturnType<typeof stubPrompter>;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;
  let orgDeleteStub: SinonStub;

  beforeEach(async () => {
    await $$.stubAuths(testOrg, testHub);
    prompterStubs = stubPrompter($$.SANDBOX);
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
    orgDeleteStub = $$.SANDBOX.stub(Org.prototype, 'delete').resolves();
  });

  describe('sandbox', () => {
    it('will throw an error when no org provided', async () => {
      await $$.stubConfig({});
      try {
        await DeleteSandbox.run();
        expect.fail('should have thrown MissingUsernameError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('MissingUsernameError');
        expect(err.message).to.equal(sbxOrgMessages.getMessage('error.missingUsername'));
      }
    });

    it('will throw an error when org cannot be found', async () => {
      const username = 'nonexistant';
      await $$.stubConfig({ 'target-org': username });
      const error = new SfError('no auth file found', 'NamedOrgNotFoundError');
      $$.SANDBOX.stub(AuthInfo, 'create').throws(error);
      try {
        await DeleteSandbox.run(['--target-org', username]);
        expect.fail('should have thrown NamedOrgNotFoundError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('NamedOrgNotFoundError');
        const errorActions = err.actions ?? [];
        expect(errorActions[0]).to.equal(`Ensure the alias or username for the ${username} org is correct.`);
        expect(errorActions[1]).to.equal(`Ensure the ${username} org has been authenticated with the CLI.`);
      }
    });

    it('will throw an error when the org is not identified as a sandbox', async () => {
      $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(false);
      await $$.stubConfig({ 'target-org': testOrg.username });
      try {
        await DeleteSandbox.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown UnknownSandboxError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('UnknownSandboxError');
        const expectedActions = sbxOrgMessages.getMessage('error.unknownSandbox.actions');
        const errorActions = err.actions ?? [];
        expect(errorActions[0]).to.equal(expectedActions);
      }
    });

    it('will prompt before attempting to delete by username', async () => {
      $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
      await $$.stubConfig({ 'target-org': testOrg.username });
      const res = await DeleteSandbox.run([]);
      expect(prompterStubs.confirm.callCount).to.equal(1);
      expect(prompterStubs.confirm.firstCall.args[0]).to.deep.equal({
        message: sbxOrgMessages.getMessage('prompt.confirm', [testOrg.username]),
      });
      expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    });

    it('will prompt before attempting to delete by alias', async () => {
      $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
      await $$.stubConfig({ 'target-org': 'myAlias' });
      $$.stubAliases({ myAlias: testOrg.username });
      const res = await DeleteSandbox.run([]);
      expect(prompterStubs.confirm.callCount).to.equal(1);
      expect(prompterStubs.confirm.firstCall.args[0]).to.deep.equal({
        message: sbxOrgMessages.getMessage('prompt.confirm', [testOrg.username]),
      });
      expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    });

    it('will NOT prompt before deleting sandbox when flag is provided', async () => {
      $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
      const res = await DeleteSandbox.run(['--no-prompt', '--target-org', testOrg.username]);
      expect(prompterStubs.confirm.callCount).to.equal(0);
      expect(sfCommandUxStubs.logSuccess.callCount).to.equal(1);
      expect(sfCommandUxStubs.logSuccess.getCalls().flatMap((call) => call.args)).to.deep.include(
        sbxOrgMessages.getMessage('success', [testOrg.username])
      );
      expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    });

    it('will catch the SandboxNotFound and wrap correctly', async () => {
      $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
      orgDeleteStub.restore();
      $$.SANDBOX.stub(Org.prototype, 'delete').throws(new SfError('bah!', 'SandboxNotFound'));
      const res = await DeleteSandbox.run(['--no-prompt', '--target-org', testOrg.username]);
      expect(prompterStubs.confirm.called).to.equal(false);
      expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
      expect(
        sfCommandUxStubs.logSuccess.getCalls().flatMap((call) => call.args),
        JSON.stringify(sfCommandUxStubs.logSuccess.getCalls().flatMap((call) => call.args))
      ).to.deep.include(sbxOrgMessages.getMessage('success.Idempotent', [testOrg.username]));
    });
  });

  describe('scratch', () => {
    it('will throw an error when no org provided', async () => {
      await $$.stubConfig({});
      try {
        await DeleteScratch.run();
        expect.fail('should have thrown MissingUsernameError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('MissingUsernameError');
        expect(err.message).to.equal(scratchOrgMessages.getMessage('error.missingUsername'));
      }
    });

    it('will prompt before attempting to delete by username', async () => {
      await $$.stubConfig({ 'target-org': testOrg.username });
      const res = await DeleteScratch.run([]);
      expect(prompterStubs.confirm.callCount).to.equal(1);
      expect(prompterStubs.confirm.firstCall.args[0]).to.deep.equal({
        message: scratchOrgMessages.getMessage('prompt.confirm', [testOrg.username]),
      });
      expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    });

    it('will prompt before attempting to delete by alias', async () => {
      const authInfoStub = {
        getFields: () => ({
          orgId: testOrg.orgId,
          isScratch: false,
        }),
      };
      $$.SANDBOX.stub(AuthInfo, 'create').resolves(authInfoStub as unknown as AuthInfo);

      await $$.stubConfig({ 'target-org': 'myAlias' });
      $$.stubAliases({ myAlias: testOrg.username });
      const res = await DeleteScratch.run(['--target-org', 'myAlias']);
      expect(prompterStubs.confirm.callCount).to.equal(1);
      expect(prompterStubs.confirm.firstCall.args[0]).to.deep.equal({
        message: scratchOrgMessages.getMessage('prompt.confirm', [testOrg.username]),
      });
      expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    });

    it('will NOT prompt before deleting scratch org when flag is provided', async () => {
      $$.SANDBOX.stub(AuthInfo.prototype, 'getFields').resolves({
        orgId: testOrg.orgId,
        isScratch: false,
      });
      await $$.stubConfig({ 'target-org': testOrg.username });
      try {
        await DeleteScratch.run(['--no-prompt', '--target-org', testOrg.username]);
        expect.fail('should have thrown UnknownScratchError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('UnknownScratchError');
      }
      // const res = await DeleteScratch.run(['--no-prompt', '--target-org', testOrg.username]);
      expect(prompterStubs.confirm.calledOnce).to.equal(false);
      // expect(sfCommandUxStubs.logSuccess.callCount).to.equal(1);
      // expect(sfCommandUxStubs.logSuccess.getCalls().flatMap((call) => call.args)).to.deep.include(
      //   scratchOrgMessages.getMessage('success', [testOrg.username])
      // );
      // expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    });

    it('will catch the ScratchOrgNotFound and wrap correctly', async () => {
      $$.SANDBOX.stub(AuthInfo.prototype, 'getFields').resolves({
        orgId: testOrg.orgId,
        isScratch: false,
      });
      orgDeleteStub.restore();
      $$.SANDBOX.stub(Org.prototype, 'delete').throws(new SfError('bah!', 'ScratchOrgNotFound'));
      const res = await DeleteScratch.run(['--no-prompt', '--target-org', testOrg.username]);
      expect(prompterStubs.confirm.calledOnce).to.equal(false);
      expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
      expect(sfCommandUxStubs.logSuccess.getCalls().flatMap((call) => call.args)).to.deep.include(
        scratchOrgMessages.getMessage('success.Idempotent', [testOrg.username])
      );
    });
  });
});
