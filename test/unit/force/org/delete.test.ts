/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator, Messages, Org, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';

import { config, expect } from 'chai';
import { stubPrompter, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { SandboxAccessor } from '@salesforce/core/lib/stateAggregator/accessors/sandboxAccessor';
import { Config } from '@oclif/core';
import { Delete } from '../../../../src/commands/force/org/delete';

config.truncateThreshold = 0;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

describe('org:delete', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const testHub = new MockTestOrgData();
  testOrg.devHubUsername = testHub.username;
  // stubs
  let prompterStubs: ReturnType<typeof stubPrompter>;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(async () => {
    await $$.stubAuths(testOrg, testHub);
    await $$.stubConfig({ 'target-org': testOrg.username });
    prompterStubs = stubPrompter($$.SANDBOX);
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
  });

  it('will throw an error when no default set', async () => {
    const deleteCommand = new Delete([], {} as Config);
    deleteCommand.configAggregator = await ConfigAggregator.create();
    $$.SANDBOX.stub(deleteCommand.configAggregator, 'getPropertyValue').onSecondCall().returns(undefined);

    try {
      await deleteCommand.run();
      expect.fail('should have thrown an error');
    } catch (e) {
      const err = e as SfError;
      expect(err.name).to.equal('MissingUsernameError');
      expect(err.message).to.equal(messages.getMessage('missingUsername'));
    }
  });

  it('will prompt before attempting to delete', async () => {
    const deleteCommand = new Delete([], {} as Config);
    deleteCommand.configAggregator = await ConfigAggregator.create();
    $$.SANDBOX.stub(deleteCommand.configAggregator, 'getPropertyValue').onThirdCall().returns(testOrg.username);
    const res = await deleteCommand.run();
    expect(prompterStubs.confirm.calledOnce).to.equal(true);
    expect(prompterStubs.confirm.firstCall.args[0]).to.equal(
      messages.getMessage('confirmDelete', ['scratch', testOrg.username])
    );
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will resolve a default alias', async () => {
    const deleteCommand = new Delete([], {} as Config);
    deleteCommand.configAggregator = await ConfigAggregator.create();
    await $$.stubConfig({ 'target-org': 'myAlias' });
    $$.stubAliases({ myAlias: testOrg.username });
    const getPropertyValueStub = $$.SANDBOX.stub(deleteCommand.configAggregator, 'getPropertyValue')
      .onSecondCall()
      .returns('myAlias');
    const res = await deleteCommand.run();
    expect(prompterStubs.confirm.calledOnce).to.equal(true);
    expect(prompterStubs.confirm.firstCall.args[0]).to.equal(
      messages.getMessage('confirmDelete', ['scratch', testOrg.username])
    );
    expect(getPropertyValueStub.calledTwice).to.be.true;
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will determine sandbox vs scratch org and delete sandbox', async () => {
    $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
    const res = await Delete.run(['--target-org', testOrg.username]);
    expect(prompterStubs.confirm.calledOnce).to.equal(true);
    expect(prompterStubs.confirm.firstCall.args[0]).to.equal(
      messages.getMessage('confirmDelete', ['sandbox', testOrg.username])
    );
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will NOT prompt before deleting scratch org when flag is provided', async () => {
    $$.SANDBOX.stub(Org.prototype, 'isSandbox').resolves(false);
    $$.SANDBOX.stub(Org.prototype, 'delete').resolves();
    const res = await Delete.run(['--noprompt', '--target-org', testOrg.username]);
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
    const res = await Delete.run(['--noprompt', '--target-org', testOrg.username]);
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
    const res = await Delete.run(['--noprompt', '--target-org', testOrg.username]);
    expect(prompterStubs.confirm.calledOnce).to.equal(false);
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    expect(sfCommandUxStubs.log.getCalls().flatMap((call) => call.args)).to.deep.include(
      messages.getMessage('deleteOrgConfigOnlyCommandSuccess', [testOrg.username])
    );
  });

  it('will catch the SandboxNotFound and wrap correctly', async () => {
    $$.SANDBOX.stub(SandboxAccessor.prototype, 'hasFile').resolves(true);
    $$.SANDBOX.stub(Org.prototype, 'delete').throws(new SfError('bah!', 'SandboxNotFound'));
    const res = await Delete.run(['--noprompt', '--target-org', testOrg.username]);
    expect(prompterStubs.confirm.called).to.equal(false);
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    expect(
      sfCommandUxStubs.log.getCalls().flatMap((call) => call.args),
      JSON.stringify(sfCommandUxStubs.log.getCalls().flatMap((call) => call.args))
    ).to.deep.include(messages.getMessage('sandboxConfigOnlySuccess', [testOrg.username]));
  });
});
