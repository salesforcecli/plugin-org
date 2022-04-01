/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { Org, Aliases, Config, ConfigAggregator, Lifecycle, SandboxEvents } from '@salesforce/core';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { expect, IConfig } from '@salesforce/command/lib/test';
import { UX } from '@salesforce/command';
import { OrgCloneCommand } from '../../../../src/commands/force/org/clone';

describe('org:clone', () => {
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
    ApexClassId: '0GQ4p000000HOL2KAO',
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
  const defFile = {
    SourceSandboxName: 'mySandbox',
    licenseType: 'Developer',
    sandboxName: 'newSandbox',
  };
  const statusEvent = {
    sandboxProcessObj,
    interval: 1,
    retries: 0,
    waitingOnAuth: false,
  };
  const oclifConfigStub = fromStub(stubInterface<IConfig.IConfig>(sandbox));

  // stubs
  let uxTableStub: sinon.SinonStub;
  let uxStyledHeaderStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  let cmd: TestOrgCloneCommand;
  let aliasSetStub: sinon.SinonStub;
  let configSetStub: sinon.SinonStub;
  let configWriteStub: sinon.SinonStub;
  let onStub: sinon.SinonStub;
  let readFileSyncStub: sinon.SinonStub;
  let configAggregatorStub;

  class TestOrgCloneCommand extends OrgCloneCommand {
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

  const runCloneCommand = async (params: string[]) => {
    cmd = new TestOrgCloneCommand(params, oclifConfigStub);
    stubMethod(sandbox, cmd, 'assignOrg').callsFake(() => {
      const orgStubOptions = {
        cloneSandbox: sandbox.stub().callsFake(async () => {
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
    onStub = sandbox
      .stub()
      .callsArgWith(1, sandboxProcessObj)
      .callsArgWith(1, statusEvent)
      .callsArgWith(1, resultObject);
    stubMethod(sandbox, Lifecycle, 'getInstance').returns({
      on: onStub,
    });
    aliasSetStub = stubMethod(sandbox, Aliases.prototype, 'set').returns(sandboxalias);
    uxTableStub = stubMethod(sandbox, UX.prototype, 'table');
    uxLogStub = stubMethod(sandbox, UX.prototype, 'log');
    uxStyledHeaderStub = stubMethod(sandbox, UX.prototype, 'styledHeader');
    readFileSyncStub = stubMethod(sandbox, fs, 'readFileSync').returns(JSON.stringify(defFile));
    return cmd.runIt();
  };

  it('will return sandbox process object', async () => {
    const res = await runCloneCommand(['-t', 'sandbox', '-u', 'DevHub', '-f', 'sandbox-def.json']);
    expect(uxStyledHeaderStub.calledOnce).to.be.true;
    expect(uxTableStub.firstCall.args[0].length).to.be.equal(12);
    expect(readFileSyncStub.calledOnce).to.be.true;
    expect(uxLogStub.callCount).to.be.equal(3);
    expect(aliasSetStub.callCount).to.be.equal(0);
    expect(configSetStub.callCount).to.be.equal(0);
    expect(configWriteStub.callCount).to.be.equal(0);
    expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
    expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(3);
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('will set alias and default username', async () => {
    const res = await runCloneCommand([
      '-t',
      'sandbox',
      '-u',
      'DevHub',
      '-f',
      'sandbox-def.json',
      '-a',
      sandboxalias,
      '-s',
    ]);
    expect(uxStyledHeaderStub.calledOnce).to.be.true;
    expect(uxTableStub.firstCall.args[0].length).to.be.equal(12);
    expect(readFileSyncStub.calledOnce).to.be.true;
    expect(uxLogStub.callCount).to.be.equal(3);
    expect(aliasSetStub.callCount).to.be.equal(1);
    expect(aliasSetStub.firstCall.args[0]).to.be.equal(sandboxalias);
    expect(aliasSetStub.firstCall.args[1]).to.be.equal(authUserName);
    expect(configSetStub.firstCall.args[0]).to.be.equal(Config.DEFAULT_USERNAME);
    expect(configSetStub.firstCall.args[1]).to.be.equal(authUserName);
    expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
    expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(3);
    expect(configWriteStub.calledOnce).to.be.true;
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  afterEach(() => {
    sandbox.restore();
  });
});
