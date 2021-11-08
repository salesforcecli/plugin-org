/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, Org, SfdxProject } from '@salesforce/core';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { IConfig } from '@oclif/config';
import * as sinon from 'sinon';
import { expect } from '@salesforce/command/lib/test';
import { UX } from '@salesforce/command';
import { Delete } from '../../../../src/commands/force/org/delete';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

describe('org:delete', () => {
  const sandbox = sinon.createSandbox();
  const username = 'scratch-test@salesforce.com';
  const sandboxUsername = 'sandbox-test@salesforce.com';
  const orgId = '00D54000000KDltEAG';
  const oclifConfigStub = fromStub(stubInterface<IConfig>(sandbox));

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
    public setProject(project: SfdxProject) {
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
        stubInterface<SfdxProject>(sandbox, {
          resolveProjectConfig: resolveProjectConfigStub,
        })
      );
      cmd.setProject(sfdxProjectStub);
    });
    stubMethod(sandbox, cmd, 'assignOrg').callsFake(() => {
      const orgStubOptions = {
        getSandboxOrgConfigField: () => {},
        deleteScratchOrg: () => {},
        getUsername: () => username,
        getOrgId: () => orgId,
      };

      if (options.isSandbox) {
        orgStubOptions.getSandboxOrgConfigField = () => sandboxUsername;
      }

      if (options.deleteScratchOrg) {
        orgStubOptions.deleteScratchOrg = () => {
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

  beforeEach(() => {});

  describe('org:delete scratch orgs', () => {
    it('will prompt before attempting to delete', async () => {
      await runDeleteCommand([]);
      expect(uxConfirmStub.calledOnce).to.equal(true);
      expect(uxConfirmStub.firstCall.args[0]).to.equal(messages.getMessage('confirmDelete', ['scratch', username]));
    });

    it('will determine sandbox vs scratch org', async () => {
      await runDeleteCommand([], { isSandbox: true });
      expect(uxConfirmStub.calledOnce).to.equal(true);
      expect(uxConfirmStub.firstCall.args[0]).to.equal(messages.getMessage('confirmDelete', ['sandbox', username]));
    });

    it('will NOT prompt before attempting to delete when flag is provided', async () => {
      const res = await runDeleteCommand(['--noprompt']);
      expect(uxConfirmStub.called).to.equal(false);
      expect(res).to.deep.equal({ orgId, username });
    });

    it('will catch the attemptingToDeleteExpiredOrDeleted and wrap correctly', async () => {
      const res = await runDeleteCommand(['--noprompt'], { deleteScratchOrg: 'attemptingToDeleteExpiredOrDeleted' });
      expect(uxConfirmStub.called).to.equal(false);
      expect(res).to.deep.equal({ orgId, username });

      expect(uxLogStub.firstCall.args[0]).to.equal(
        messages.getMessage('deleteOrgConfigOnlyCommandSuccess', [username])
      );
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  // describe('delete sandbox', () => {
  //   it('sandbox delete success', async () => {
  //     sandbox.stub(Org, 'create').callsFake(() => prodOrg);
  //     orgDeleteCommand.flags = { targetusername: sbUser, noprompt: true };
  //     orgDeleteCommand.org = {
  //       getOrgId: () => sandboxOrgId,
  //       getUsername: () => sbUser,
  //       getSandboxOrgConfigField: () => prodUser,
  //       remove: () => Promise.resolve(),
  //     };
  //     const spy = sinon.spy(orgDeleteCommand.org, 'remove');
  //     await orgDeleteCommand.run();
  //     expect(prodSandboxOrgMock.deleteSandbox.callCount).to.equal(1);
  //     expect(prodOrg.getOrgId.callCount).to.equal(0);
  //     expect(spy.called).to.be.true;
  //   });
  //
  //   // eslint-disable-next-line @typescript-eslint/require-await
  //   it('prod org user auth not found', async () => {
  //     sandbox.stub(Org, 'create').callsFake(() => {
  //       throw new Error('No org configuration found for name');
  //     });
  //     orgDeleteCommand.flags = { targetusername: sbUser, noprompt: true };
  //     orgDeleteCommand.org = {
  //       getOrgId: () => sandboxOrgId,
  //       getUsername: () => sbUser,
  //       getSandboxOrgConfigField: () => prodUser,
  //       remove: () => Promise.resolve(),
  //     };
  //     expect(orgDeleteCommand.run()).to.be.rejectedWith(
  //       Error,
  //       new RegExp('No org configuration found for name'),
  //       'should have thrown a Prod Org User not found error'
  //     );
  //   });
  //
  //   it('sandbox delete no SandboxProcess', async () => {
  //     sandbox.stub(Org, 'create').callsFake(() => prodOrg);
  //     orgDeleteCommand.flags = { targetusername: sbUser, noprompt: true };
  //     orgDeleteCommand.org = {
  //       getOrgId: () => sandboxOrgId,
  //       getUsername: () => sbUser,
  //       getSandboxOrgConfigField: () => prodUser,
  //       remove: () => Promise.resolve(),
  //     };
  //     const spy = sinon.spy(orgDeleteCommand.org, 'remove');
  //     prodSandboxOrgMock.deleteSandbox.throws(
  //       new SfdxError('Attempting to delete an already deleted org', 'sandboxProcessNotFoundByOrgId')
  //     );
  //     await orgDeleteCommand.run();
  //     expect(prodSandboxOrgMock.deleteSandbox.callCount).to.equal(1);
  //     expect(prodOrg.getOrgId.callCount).to.equal(0);
  //     expect(spy.called).to.be.true;
  //   });
  //
  //   // eslint-disable-next-line @typescript-eslint/require-await
  //   it('sandbox delete some failure', async () => {
  //     sandbox.stub(Org, 'create').callsFake(() => prodOrg);
  //     orgDeleteCommand.flags = { targetusername: sbUser, noprompt: true };
  //     orgDeleteCommand.org = {
  //       getOrgId: () => sandboxOrgId,
  //       getUsername: () => sbUser,
  //       getSandboxOrgConfigField: () => prodUser,
  //       remove: () => Promise.resolve(),
  //     };
  //     prodSandboxOrgMock.deleteSandbox.throws(new SfdxError('Something went wrong', 'someFailure'));
  //     expect(orgDeleteCommand.run()).to.be.rejectedWith(
  //       Error,
  //       new RegExp('Something went wrong'),
  //       'should have thrown an exception'
  //     );
  //   });
  //
  //   // it('sandbox delete success with prompt', async () => {
  //   //   sandbox.stub(Org, 'create').callsFake(() => prodOrg);
  //   //   sandbox.stub(heroku, 'prompt').callsFake(() => BBPromise.resolve('y'));
  //   //   orgDeleteCommand.flags = { targetusername: sbUser };
  //   //   orgDeleteCommand.org = {
  //   //     getOrgId: () => sandboxOrgId,
  //   //     getUsername: () => sbUser,
  //   //     getSandboxOrgConfigField: () => prodUser,
  //   //     remove: () => Promise.resolve(),
  //   //   };
  //   //   const spy = sinon.spy(orgDeleteCommand.org, 'remove');
  //   //   await orgDeleteCommand.run();
  //   //   expect(prodSandboxOrgMock.deleteSandbox.callCount).to.equal(1);
  //   //   expect(prodOrg.getOrgId.callCount).to.equal(0);
  //   //   expect(spy.called).to.be.true;
  //   // });
  //
  //   it('sandbox prompt no', async () => {
  //     sandbox.stub(Org, 'create').callsFake(() => prodOrg);
  //     sandbox.stub(heroku, 'prompt').callsFake(() => BBPromise.resolve('n'));
  //     orgDeleteCommand.flags = { targetusername: sbUser };
  //     orgDeleteCommand.org = {
  //       getOrgId: () => sandboxOrgId,
  //       getUsername: () => sbUser,
  //       getSandboxOrgConfigField: () => prodUser,
  //       remove: () => Promise.resolve(),
  //     };
  //     const spy = sinon.spy(orgDeleteCommand.org, 'remove');
  //     await orgDeleteCommand.run();
  //     expect(prodSandboxOrgMock.deleteSandbox.callCount).to.equal(0);
  //     expect(prodOrg.getOrgId.callCount).to.equal(0);
  //     expect(spy.called).to.be.false;
  //   });
  // });
});
