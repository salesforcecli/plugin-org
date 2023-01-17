/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Lifecycle, Org, SandboxEvents, SandboxProcessObject, SfProject, AuthFields } from '@salesforce/core';
import { Spinner } from '@salesforce/sf-plugins-core/lib/ux';
import { Config as IConfig } from '@oclif/core/lib/interfaces';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { Ux } from '@salesforce/sf-plugins-core/lib/ux';
import { OrgAccessor } from '@salesforce/core/lib/stateAggregator';
import CreateSandbox from '../../../../src/commands/env/create/sandbox';
import { SandboxProgress } from '../../../../lib/shared/sandboxProgress';

const sandboxProcessObj: SandboxProcessObject = {
  Id: '0GR4p000000U8EMXXX',
  Status: 'Completed',
  SandboxName: 'TestSandbox',
  SandboxInfoId: '0GQ4p000000U6sKXXX',
  LicenseType: 'DEVELOPER',
  CreatedDate: '2021-12-07T16:20:21.000+0000',
  CopyProgress: 100,
  SandboxOrganization: '00D2f0000008XXX',
  SourceId: '123',
  Description: 'sandbox description',
  ApexClassId: '123',
  EndDate: '2021-12-07T16:38:47.000+0000',
};

const fakeOrg: AuthFields = {
  orgId: '00Dsomefakeorg1',
  instanceUrl: 'https://some.fake.org',
  username: 'somefake.org',
};

describe('env:create:sandbox', () => {
  beforeEach(() => {
    stubMethod(sandbox, OrgAccessor.prototype, 'read').callsFake(async (): Promise<AuthFields> => fakeOrg);
    stubMethod(sandbox, OrgAccessor.prototype, 'write').callsFake(async (): Promise<AuthFields> => fakeOrg);
  });

  const sandbox = sinon.createSandbox();
  const oclifConfigStub = fromStub(stubInterface<IConfig>(sandbox));
  // stubs
  let resolveProjectConfigStub: sinon.SinonStub;
  let createSandboxStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  let cmd: TestCreate;

  class TestCreate extends CreateSandbox {
    public async runIt() {
      await this.init();
      return this.run();
    }
    public setProject(project: SfProject) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.project = project;
    }
  }

  const createCommand = async (params: string[]) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    cmd = new TestCreate(params, oclifConfigStub);
    stubMethod(sandbox, cmd, 'assignProject').callsFake(() => {
      const sfProjectStub = fromStub(
        stubInterface<SfProject>(sandbox, {
          resolveProjectConfig: resolveProjectConfigStub,
        })
      );
      cmd.setProject(sfProjectStub);
    });

    stubMethod(sandbox, TestCreate.prototype, 'warn');
    uxLogStub = stubMethod(sandbox, TestCreate.prototype, 'log');
    stubMethod(sandbox, Ux.prototype, 'styledHeader');
    stubMethod(sandbox, TestCreate.prototype, 'table');
    stubMethod(sandbox, SandboxProgress.prototype, 'getSandboxProgress');
    stubMethod(sandbox, SandboxProgress.prototype, 'formatProgressStatus');
    stubMethod(sandbox, Spinner.prototype, 'start');
    stubMethod(sandbox, Spinner.prototype, 'stop');
    stubMethod(sandbox, Spinner.prototype, 'status');
    return cmd;
  };

  describe('sandbox', () => {
    it('will print the correct message for asyncResult lifecycle event', async () => {
      const command = await createCommand(['-o', 'testProdOrg', '--name', 'mysandboxx', '--no-prompt']);

      stubMethod(sandbox, cmd, 'readJsonDefFile').returns({
        licenseType: 'licenseFromJon',
      });
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'getUsername').returns('testProdOrg');
      const createStub = stubMethod(sandbox, Org.prototype, 'createSandbox').callsFake(async () => (async () => {})().catch());

      await command.runIt();

      // no SandboxName defined, so we should generate one that starts with sbx
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(createStub.firstCall.args[0].SandboxName).includes('mysandboxx');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(createStub.firstCall.args[0].SandboxName.length).equals(10);

      Lifecycle.getInstance().on(SandboxEvents.EVENT_ASYNC_RESULT, async (result) => {
        expect(result).to.deep.equal(sandboxProcessObj);
        expect(uxLogStub.firstCall.args[0]).to.includes('0GR4p000000U8EMXXX');
      });

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_ASYNC_RESULT, sandboxProcessObj);
    });
  });

  afterEach(() => {
    sandbox.restore();
    createSandboxStub?.restore();
  });
});
