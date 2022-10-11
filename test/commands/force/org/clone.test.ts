/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Org,
  Lifecycle,
  StateAggregator,
  SandboxEvents,
  SfdxConfigAggregator,
  OrgConfigProperties,
} from '@salesforce/core';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { expect } from '@salesforce/command/lib/test';
import { Config } from '@oclif/core';
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
  const oclifConfigStub = fromStub(stubInterface<Config>(sandbox));

  // stubs
  let uxTableStub: sinon.SinonStub;
  let uxStyledHeaderStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  let cmd: TestOrgCloneCommand;
  let aliasSetStub: sinon.SinonSpy;
  let configSetStub: sinon.SinonStub;
  let configWriteStub: sinon.SinonStub;
  let onStub: sinon.SinonStub;
  let readJsonDefFileStub: sinon.SinonStub;
  let cloneSandboxStub: sinon.SinonStub;
  let configAggregatorStub;

  class TestOrgCloneCommand extends OrgCloneCommand {
    public async runIt() {
      await this.init();
      return this.run();
    }
    public setOrg(org: Org) {
      this.org = org;
    }
    public setConfigAggregator(configAggregator: SfdxConfigAggregator) {
      this.configAggregator = configAggregator;
    }
  }

  const runCloneCommand = async (params: string[], fails?: boolean) => {
    cmd = new TestOrgCloneCommand(params, oclifConfigStub);
    stubMethod(sandbox, cmd, 'assignOrg').callsFake(() => {
      cloneSandboxStub = sandbox.stub().callsFake(async () => {
        if (!fails) {
          return sandboxProcessObj;
        }
        throw new Error('MyError');
      });
      const orgStubOptions = {
        cloneSandbox: cloneSandboxStub,
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
      configAggregatorStub = fromStub(stubInterface<SfdxConfigAggregator>(sandbox, configAggregatorStubOptions));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      cmd.setConfigAggregator(configAggregatorStub);
    });
    if (!fails) {
      onStub = sandbox
        .stub()
        .callsArgWith(1, sandboxProcessObj)
        .callsArgWith(1, statusEvent)
        .callsArgWith(1, resultObject);
    } else {
      onStub = sandbox.stub().callsFake((event, cb) => {
        expect(event).to.exist;
        expect(cb).to.be.a('function');
      });
    }
    stubMethod(sandbox, Lifecycle, 'getInstance').returns({
      on: onStub,
    });
    aliasSetStub = sinon.spy();
    stubMethod(sandbox, StateAggregator, 'getInstance').returns({
      aliases: {
        set: aliasSetStub,
        getAll: () => ({
          sanboxname: sandboxalias,
        }),
      },
    });
    uxTableStub = stubMethod(sandbox, UX.prototype, 'table');
    uxLogStub = stubMethod(sandbox, UX.prototype, 'log');
    uxStyledHeaderStub = stubMethod(sandbox, UX.prototype, 'styledHeader');
    readJsonDefFileStub = stubMethod(sandbox, cmd, 'readJsonDefFile').returns(defFile);
    return cmd;
  };

  it('will return sandbox process object', async () => {
    const commmand = await runCloneCommand(['-t', 'sandbox', '-u', 'DevHub', '-f', 'sandbox-def.json']);
    const res = await commmand.runIt();
    expect(uxStyledHeaderStub.calledOnce).to.be.true;
    expect(uxTableStub.firstCall.args[0].length).to.be.equal(12);
    expect(readJsonDefFileStub.calledOnce).to.be.true;
    expect(uxLogStub.callCount).to.be.equal(3);
    expect(aliasSetStub.callCount).to.be.equal(0);
    expect(configSetStub.callCount).to.be.equal(0);
    expect(configWriteStub.callCount).to.be.equal(0);
    expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
    expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(3);
    expect(cloneSandboxStub.firstCall.firstArg).to.deep.equal({
      LicenseType: 'Developer',
      SandboxName: 'newSandbox',
    });
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('will return sandbox process object varargs override defFile', async () => {
    const licenseType = 'Enterprise';
    const commmand = await runCloneCommand([
      '-t',
      'sandbox',
      '-u',
      'DevHub',
      '-f',
      'sandbox-def.json',
      `licenseType=${licenseType}`,
    ]);
    const res = await commmand.runIt();
    expect(uxStyledHeaderStub.calledOnce).to.be.true;
    expect(uxTableStub.firstCall.args[0].length).to.be.equal(12);
    expect(readJsonDefFileStub.calledOnce).to.be.true;
    expect(uxLogStub.callCount).to.be.equal(3);
    expect(aliasSetStub.callCount).to.be.equal(0);
    expect(configSetStub.callCount).to.be.equal(0);
    expect(configWriteStub.callCount).to.be.equal(0);
    expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
    expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(3);
    expect(cloneSandboxStub.firstCall.firstArg).to.deep.equal({
      LicenseType: licenseType,
      SandboxName: 'newSandbox',
    });
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('will set alias and default username', async () => {
    const commmand = await runCloneCommand([
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
    const res = await commmand.runIt();
    expect(uxStyledHeaderStub.calledOnce).to.be.true;
    expect(uxTableStub.firstCall.args[0].length).to.be.equal(12);
    expect(readJsonDefFileStub.calledOnce).to.be.true;
    expect(uxLogStub.callCount).to.be.equal(3);
    expect(aliasSetStub.callCount).to.be.equal(1);
    expect(aliasSetStub.firstCall.args[0]).to.be.equal(sandboxalias);
    expect(aliasSetStub.firstCall.args[1]).to.be.equal(authUserName);
    expect(configSetStub.firstCall.args[0]).to.be.equal(OrgConfigProperties.TARGET_ORG);
    expect(configSetStub.firstCall.args[1]).to.be.equal(authUserName);
    expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
    expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(3);
    expect(cloneSandboxStub.firstCall.firstArg).to.deep.equal({
      LicenseType: 'Developer',
      SandboxName: 'newSandbox',
    });
    expect(configWriteStub.calledOnce).to.be.true;
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('cloneSandbox fails and wont set alias or default username', async () => {
    try {
      const commmand = await runCloneCommand(
        ['-t', 'sandbox', '-u', 'DevHub', '-f', 'sandbox-def.json', '-a', sandboxalias, '-s'],
        true
      );
      await commmand.runIt();
      sinon.assert.fail('the above should throw an error');
    } catch (e) {
      expect(uxStyledHeaderStub.calledOnce).to.be.false;
      expect(uxTableStub.calledOnce).to.be.false;
      expect(readJsonDefFileStub.calledOnce).to.be.true;
      expect(uxLogStub.callCount).to.be.equal(0);
      expect(aliasSetStub.callCount).to.be.equal(0);
      expect(configSetStub.callCount).to.be.equal(0);
      expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
      expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
      expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
      expect(onStub.callCount).to.be.equal(3);
      expect(cloneSandboxStub.firstCall.firstArg).to.deep.equal({
        LicenseType: 'Developer',
        SandboxName: 'newSandbox',
      });
      expect(configWriteStub.calledOnce).to.be.false;
    }
  });

  afterEach(() => {
    sandbox.restore();
  });
});
