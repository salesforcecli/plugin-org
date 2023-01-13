/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, Org, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';

import { expect } from 'chai';
import { Config } from '@oclif/core';
import { Delete } from '../../../../src/commands/force/org/delete';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

describe('org:delete', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const testHub = new MockTestOrgData();
  testOrg.devHubUsername = testHub.username;
  // stubs
  let uxConfirmStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;

  beforeEach(async () => {
    await $$.stubAuths(testOrg, testHub);
    await $$.stubConfig({ 'target-org': testOrg.username });
  });

  afterEach(async () => {
    $$.restore();
  });

  const runDeleteCommand = async (params: string[] = []) => {
    const cmd = new Delete(params, {} as Config);

    uxConfirmStub = $$.SANDBOX.stub(cmd, 'confirm');
    uxLogStub = $$.SANDBOX.stub(cmd, 'log');

    return cmd.run();
  };

  it('will prompt before attempting to delete', async () => {
    const res = await runDeleteCommand([]);
    expect(uxConfirmStub.calledOnce).to.equal(true);
    expect(uxConfirmStub.firstCall.args[0]).to.equal(
      messages.getMessage('confirmDelete', ['scratch', testOrg.username])
    );
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will determine sandbox vs scratch org and delete sandbox', async () => {
    $$.SANDBOX.stub(Org.prototype, 'isSandbox').resolves(true);
    const res = await runDeleteCommand([]);
    expect(uxConfirmStub.calledOnce).to.equal(true);
    expect(uxConfirmStub.firstCall.args[0]).to.equal(
      messages.getMessage('confirmDelete', ['sandbox', testOrg.username])
    );
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will NOT prompt before deleting scratch org when flag is provided', async () => {
    $$.SANDBOX.stub(Org.prototype, 'isSandbox').resolves(false);
    $$.SANDBOX.stub(Org.prototype, 'delete').resolves();
    const res = await runDeleteCommand(['--noprompt']);
    expect(uxConfirmStub.called).to.equal(false);
    expect(uxLogStub.callCount).to.equal(2);
    expect(uxLogStub.getCalls().flatMap((call) => call.args)).to.deep.include(
      messages.getMessage('deleteOrgCommandSuccess', [testOrg.username])
    );
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will NOT prompt before deleting sandbox when flag is provided', async () => {
    $$.SANDBOX.stub(Org.prototype, 'isSandbox').resolves(true);
    $$.SANDBOX.stub(Org.prototype, 'delete').resolves();
    const res = await runDeleteCommand(['--noprompt']);
    expect(uxConfirmStub.called).to.equal(false);
    expect(uxLogStub.callCount).to.equal(2);
    expect(uxLogStub.getCalls().flatMap((call) => call.args)).to.deep.include(
      messages.getMessage('commandSandboxSuccess', [testOrg.username])
    );
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
  });

  it('will catch the ScratchOrgNotFound and wrap correctly', async () => {
    $$.SANDBOX.stub(Org.prototype, 'isSandbox').resolves(false);
    $$.SANDBOX.stub(Org.prototype, 'delete').throws(new SfError('bah!', 'ScratchOrgNotFound'));
    const res = await runDeleteCommand(['--noprompt']);
    expect(uxConfirmStub.called).to.equal(false);
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    expect(uxLogStub.getCalls().flatMap((call) => call.args)).to.deep.include(
      messages.getMessage('deleteOrgConfigOnlyCommandSuccess', [testOrg.username])
    );
  });

  it('will catch the SandboxNotFound and wrap correctly', async () => {
    $$.SANDBOX.stub(Org.prototype, 'isSandbox').resolves(true);
    $$.SANDBOX.stub(Org.prototype, 'delete').throws(new SfError('bah!', 'SandboxNotFound'));
    const res = await runDeleteCommand(['--noprompt']);
    expect(uxConfirmStub.called).to.equal(false);
    expect(res).to.deep.equal({ orgId: testOrg.orgId, username: testOrg.username });
    expect(uxLogStub.getCalls().flatMap((call) => call.args)).to.deep.include(
      messages.getMessage('sandboxConfigOnlySuccess', [testOrg.username])
    );
  });
});
