/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org, Aliases, Config, ConfigAggregator, Lifecycle, SandboxEvents } from '@salesforce/core';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { expect, IConfig } from '@salesforce/command/lib/test';
import { UX } from '@salesforce/command';
import { OrgStatusCommand } from '../../../../src/commands/force/org/status';

describe('org:delete', () => {
  const sandbox = sinon.createSandbox();
  const sanboxname = 'my-sandbox';
  const sandboxalias = 'my-sandbox-alias';
  const authUserName = 'my-user';
  const sandboxProcessObj = {
    attributes: {
      type: 'SandboxProcess',
      url: '/services/data/v54.0/tooling/sobjects/SandboxProcess/0GR4p000000HQG4GAO',
    },
    Id: '0GR4p000000HQG4GAO',
    Status: 'Completed',
    SandboxName: sanboxname,
    SandboxInfoId: '0GQ4p000000HOL2GAO',
    LicenseType: 'DEVELOPER',
    CreatedDate: '2022-03-02T15:30:32.000+0000',
    CopyProgress: 100,
    SandboxOrganization: '00D2f0000008gzD',
    SourceId: null,
    Description: null,
    EndDate: '2022-03-02T15:45:16.000+0000',
  };
  const resultObject = {
    sandboxProcessObj,
    sandboxRes: {
      authUserName,
      authCode: 'my-auth-code',
      instanceUrl: 'https://my-instance.com',
      loginUrl: 'https://my-login.com',
    },
  };
  const oclifConfigStub = fromStub(stubInterface<IConfig.IConfig>(sandbox));

  // stubs
  let uxTableStub: sinon.SinonStub;
  let cmd: TestOrgStatusCommand;
  let aliasSetStub: sinon.SinonStub;
  let configSetStub: sinon.SinonStub;
  let configWriteStub: sinon.SinonStub;
  let configAggregatorStub;

  class TestOrgStatusCommand extends OrgStatusCommand {
    public async runIt() {
      await this.init();
      return this.run();
    }
    public setOrg(org: Org) {
      this.org = org;
    }
    public setConfigAggregator(configAggregator: ConfigAggregator) {
      this.configAggregator = configAggregator;
    }
  }

  const runStatusCommand = async (params: string[]) => {
    cmd = new TestOrgStatusCommand(params, oclifConfigStub);
    stubMethod(sandbox, cmd, 'assignOrg').callsFake(() => {
      const orgStubOptions = {
        sandboxStatus: sinon.stub().callsFake(async () => {
          await Lifecycle.getInstance().emit(SandboxEvents.EVENT_RESULT, resultObject);
          return sandboxProcessObj;
        }),
      };
      const orgStub = fromStub(stubInterface<Org>(sandbox, orgStubOptions));
      cmd.setOrg(orgStub);
      configSetStub = sinon.stub().returns(true);
      configWriteStub = sinon.stub().resolves(true);
      const configAggregatorStubOptions = {
        getGlobalConfig: () => ({
          set: configSetStub,
          write: configWriteStub,
        }),
      };
      configAggregatorStub = fromStub(stubInterface<ConfigAggregator>(sandbox, configAggregatorStubOptions));
      cmd.setConfigAggregator(configAggregatorStub);
    });
    aliasSetStub = stubMethod(sandbox, Aliases.prototype, 'set').returns(sandboxalias);
    uxTableStub = stubMethod(sandbox, UX.prototype, 'table');
    return cmd.runIt();
  };

  it('will return sandbox process object', async () => {
    const res = await runStatusCommand(['--sandboxname', sanboxname]);
    expect(res).to.deep.equal(sandboxProcessObj);
    expect(uxTableStub.firstCall.args[0].length).to.equal(12);
  });

  it('will set alias and default username', async () => {
    const res = await runStatusCommand([
      '--sandboxname',
      sanboxname,
      '--setalias',
      sandboxalias,
      '--setdefaultusername',
    ]);
    expect(aliasSetStub.callCount).to.be.equal(1);
    expect(aliasSetStub.firstCall.args[0]).to.be.equal(sandboxalias);
    expect(aliasSetStub.firstCall.args[1]).to.be.equal(authUserName);
    expect(configSetStub.firstCall.args[0]).to.be.equal(Config.DEFAULT_USERNAME);
    expect(configSetStub.firstCall.args[1]).to.be.equal(authUserName);
    expect(configWriteStub.calledOnce).to.be.true;
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  afterEach(() => {
    sandbox.restore();
  });
});
