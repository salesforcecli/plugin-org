/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages, Org, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { config, expect } from 'chai';
import { stubPrompter, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { SandboxAccessor } from '../../../../node_modules/@salesforce/core/lib/stateAggregator/accessors/sandboxAccessor.js';
import { Delete as LegacyDelete } from '../../../../src/commands/force/org/delete.js';

config.truncateThreshold = 0;
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

describe('[DEPRECATED] force:org:delete', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const testHub = new MockTestOrgData();
  testOrg.devHubUsername = testHub.username;
  // stubs
  let prompterStubs: ReturnType<typeof stubPrompter>;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(async () => {
    await $$.stubAuths(testOrg, testHub);
    prompterStubs = stubPrompter($$.SANDBOX);
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
  });

  it('will prompt before attempting to delete', async () => {
    await $$.stubConfig({ 'target-org': testOrg.username });
    const res = await LegacyDelete.run([]);
    expect(prompterStubs.confirm.callCount).to.equal(1);
    expect(prompterStubs.confirm.firstCall.args[0]).to.deep.equal({
      message: messages.getMessage('confirmDelete', ['scratch', testOrg.username]),
    });
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will resolve a default alias', async () => {
    await $$.stubConfig({ 'target-org': 'myAlias' });
    $$.stubAliases({ myAlias: testOrg.username });
    const res = await LegacyDelete.run([]);
    expect(prompterStubs.confirm.callCount).to.equal(1);
    expect(prompterStubs.confirm.firstCall.args[0]).to.deep.equal({
      message: messages.getMessage('confirmDelete', ['scratch', testOrg.username]),
    });
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will throw an error when no default set', async () => {
    await $$.stubConfig({});
    try {
      await LegacyDelete.run();
      expect.fail('should have thrown an error');
    } catch (e) {
      const err = e as SfError;
      expect(err.name).to.equal('MissingUsernameError');
      expect(err.message).to.equal(messages.getMessage('missingUsername'));
    }
  });

  it('will determine sandbox vs scratch org and delete sandbox', async () => {
    $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
    const res = await LegacyDelete.run(['--target-org', testOrg.username]);
    expect(prompterStubs.confirm.callCount).to.equal(1);
    expect(prompterStubs.confirm.firstCall.args[0]).to.deep.equal({
      message: messages.getMessage('confirmDelete', ['sandbox', testOrg.username]),
    });
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will NOT prompt before deleting scratch org when flag is provided', async () => {
    $$.SANDBOX.stub(Org.prototype, 'isSandbox').resolves(false);
    $$.SANDBOX.stub(Org.prototype, 'delete').resolves();
    const res = await LegacyDelete.run(['--noprompt', '--target-org', testOrg.username]);
    expect(prompterStubs.confirm.calledOnce).to.equal(false);
    expect(sfCommandUxStubs.log.callCount).to.equal(1);
    expect(sfCommandUxStubs.log.getCalls().flatMap((call) => call.args)).to.deep.include(
      messages.getMessage('deleteOrgCommandSuccess', [testOrg.username])
    );
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will NOT prompt before deleting sandbox when flag is provided', async () => {
    $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
    $$.SANDBOX.stub(Org.prototype, 'delete').resolves();
    const res = await LegacyDelete.run(['--noprompt', '--target-org', testOrg.username]);
    expect(prompterStubs.confirm.calledOnce).to.equal(false);
    expect(sfCommandUxStubs.log.callCount).to.equal(1);
    expect(sfCommandUxStubs.log.getCalls().flatMap((call) => call.args)).to.deep.include(
      messages.getMessage('commandSandboxSuccess', [testOrg.username])
    );
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will catch the ScratchOrgNotFound and wrap correctly', async () => {
    $$.SANDBOX.stub(Org.prototype, 'isSandbox').resolves(false);
    $$.SANDBOX.stub(Org.prototype, 'delete').throws(new SfError('bah!', 'ScratchOrgNotFound'));
    const res = await LegacyDelete.run(['--noprompt', '--target-org', testOrg.username]);
    expect(prompterStubs.confirm.calledOnce).to.equal(false);
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    expect(sfCommandUxStubs.log.getCalls().flatMap((call) => call.args)).to.deep.include(
      messages.getMessage('deleteOrgConfigOnlyCommandSuccess', [testOrg.username])
    );
  });

  it('will catch the SandboxNotFound and wrap correctly', async () => {
    $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
    $$.SANDBOX.stub(Org.prototype, 'delete').throws(new SfError('bah!', 'SandboxNotFound'));
    const res = await LegacyDelete.run(['--noprompt', '--target-org', testOrg.username]);
    expect(prompterStubs.confirm.called).to.equal(false);
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    expect(
      sfCommandUxStubs.log.getCalls().flatMap((call) => call.args),
      JSON.stringify(sfCommandUxStubs.log.getCalls().flatMap((call) => call.args))
    ).to.deep.include(messages.getMessage('sandboxConfigOnlySuccess', [testOrg.username]));
  });
});
