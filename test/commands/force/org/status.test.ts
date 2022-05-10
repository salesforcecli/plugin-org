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

describe('org:status', () => {
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
  let configSetStub: sinon.SinonStub;
  let configWriteStub: sinon.SinonStub;
  let onStub: sinon.SinonStub;
  let updateValueStub: sinon.SinonStub;
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
        sandboxStatus: sandbox.stub().callsFake(async () => {
          return sandboxProcessObj;
        }),
      };
      const orgStub = fromStub(stubInterface<Org>(sandbox, orgStubOptions));
      cmd.setOrg(orgStub);
      configSetStub = sandbox.stub().returns(true);
      configWriteStub = sandbox.stub().resolves(true);
      const configAggregatorStubOptions = {
        getGlobalConfig: () => ({
          set: configSetStub,
          write: configWriteStub,
        }),
      };
      configAggregatorStub = fromStub(stubInterface<ConfigAggregator>(sandbox, configAggregatorStubOptions));
      cmd.setConfigAggregator(configAggregatorStub);
    });
    onStub = sandbox.stub().callsArgWith(1, resultObject);
    stubMethod(sandbox, Lifecycle, 'getInstance').returns({
      on: onStub,
    });
    uxTableStub = stubMethod(sandbox, UX.prototype, 'table');
    stubMethod(sandbox, UX.prototype, 'log');
    stubMethod(sandbox, UX.prototype, 'styledHeader');
    updateValueStub = stubMethod(sandbox, Aliases.prototype, 'updateValue');
    return cmd.runIt();
  };

  it('will return sandbox process object', async () => {
    const res = await runStatusCommand(['--sandboxname', sanboxname]);
    expect(uxTableStub.firstCall.args[0].length).to.equal(12);
    expect(updateValueStub.callCount).to.be.equal(0);
    expect(configSetStub.callCount).to.be.equal(0);
    expect(configWriteStub.callCount).to.be.equal(0);
    expect(onStub.callCount).to.be.equal(2);
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('will set alias', async () => {
    const res = await runStatusCommand([
      '--sandboxname',
      sanboxname,
      '--setalias',
      sandboxalias,
      '--setdefaultusername',
    ]);
    expect(updateValueStub.firstCall.args).to.deep.equal([sandboxalias, authUserName]);
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(2);
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('will set default username', async () => {
    const res = await runStatusCommand(['--sandboxname', sanboxname, '--setdefaultusername']);
    expect(configSetStub.firstCall.args[0]).to.be.equal(Config.DEFAULT_USERNAME);
    expect(configSetStub.firstCall.args[1]).to.be.equal(authUserName);
    expect(configWriteStub.calledOnce).to.be.true;
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(2);
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  afterEach(() => {
    sandbox.restore();
  });
});
