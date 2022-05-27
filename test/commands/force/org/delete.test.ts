/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, Org, SfProject } from '@salesforce/core';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { expect } from '@salesforce/command/lib/test';
import { Config } from '@oclif/core';
import { UX } from '@salesforce/command';
import { Delete } from '../../../../src/commands/force/org/delete';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

describe('org:delete', () => {
  const sandbox = sinon.createSandbox();
  const username = 'scratch-test@salesforce.com';
  const orgId = '00D54000000KDltEAG';
  const oclifConfigStub = fromStub(stubInterface<Config>(sandbox));

  // stubs
  let resolveProjectConfigStub: sinon.SinonStub;
  let uxConfirmStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  let cmd: TestDelete;

  class TestDelete extends Delete {
    public async runIt() {
      await this.init();
      return this.run();
    }
    public setOrg(org: Org) {
      this.org = org;
    }
    public setProject(project: SfProject) {
      this.project = project;
    }
  }

  const runDeleteCommand = async (
    params: string[],
    options: { isSandbox?: boolean; deleteScratchOrg?: string } = { isSandbox: false }
  ) => {
    cmd = new TestDelete(params, oclifConfigStub);
    stubMethod(sandbox, cmd, 'assignProject').callsFake(() => {
      const sfdxProjectStub = fromStub(
        stubInterface<SfProject>(sandbox, {
          resolveProjectConfig: resolveProjectConfigStub,
        })
      );
      cmd.setProject(sfdxProjectStub);
    });
    stubMethod(sandbox, cmd, 'assignOrg').callsFake(() => {
      const orgStubOptions = {
        getSandboxOrgConfigField: () => {},
        delete: () => {},
        getUsername: () => username,
        getOrgId: () => orgId,
        isSandbox: () => options.isSandbox,
      };

      if (options.deleteScratchOrg) {
        orgStubOptions.delete = () => {
          const e = new Error();
          e.name = options.deleteScratchOrg;
          throw e;
        };
      }

      const orgStub = fromStub(stubInterface<Org>(sandbox, orgStubOptions));
      cmd.setOrg(orgStub);
    });
    uxConfirmStub = stubMethod(sandbox, UX.prototype, 'confirm');
    uxLogStub = stubMethod(sandbox, UX.prototype, 'log');

    return cmd.runIt();
  };

  it('will prompt before attempting to delete', async () => {
    const res = await runDeleteCommand([]);
    expect(uxConfirmStub.calledOnce).to.equal(true);
    expect(uxConfirmStub.firstCall.args[0]).to.equal(messages.getMessage('confirmDelete', ['scratch', username]));
    expect(res).to.deep.equal({ orgId, username });
  });

  it('will determine sandbox vs scratch org and delete sandbox', async () => {
    const res = await runDeleteCommand([], { isSandbox: true });
    expect(uxConfirmStub.calledOnce).to.equal(true);
    expect(uxConfirmStub.firstCall.args[0]).to.equal(messages.getMessage('confirmDelete', ['sandbox', username]));
    expect(res).to.deep.equal({ orgId, username });
  });

  it('will NOT prompt before deleting scratch org when flag is provided', async () => {
    const res = await runDeleteCommand(['--noprompt']);
    expect(uxConfirmStub.called).to.equal(false);
    expect(uxLogStub.callCount).to.equal(1);
    expect(uxLogStub.firstCall.args[0]).to.equal(messages.getMessage('deleteOrgCommandSuccess', [username]));
    expect(res).to.deep.equal({ orgId, username });
  });

  it('will NOT prompt before deleting sandbox when flag is provided', async () => {
    const res = await runDeleteCommand(['--noprompt'], { isSandbox: true });
    expect(uxConfirmStub.called).to.equal(false);
    expect(uxLogStub.callCount).to.equal(1);
    expect(uxLogStub.firstCall.args[0]).to.equal(messages.getMessage('commandSandboxSuccess', [username]));
    expect(res).to.deep.equal({ orgId, username });
  });

  it('will catch the ScratchOrgNotFound and wrap correctly', async () => {
    const res = await runDeleteCommand(['--noprompt'], { deleteScratchOrg: 'ScratchOrgNotFound' });
    expect(uxConfirmStub.called).to.equal(false);
    expect(res).to.deep.equal({ orgId, username });
    expect(uxLogStub.firstCall.args[0]).to.equal(messages.getMessage('deleteOrgConfigOnlyCommandSuccess', [username]));
  });

  it('will catch the SandboxNotFound and wrap correctly', async () => {
    const res = await runDeleteCommand(['--noprompt'], {
      deleteScratchOrg: 'SandboxNotFound',
      isSandbox: true,
    });
    expect(uxConfirmStub.called).to.equal(false);
    expect(res).to.deep.equal({ orgId, username });
    expect(uxLogStub.firstCall.args[0]).to.equal(messages.getMessage('sandboxConfigOnlySuccess', [username]));
  });

  afterEach(() => {
    sandbox.restore();
  });
});
