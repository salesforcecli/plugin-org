/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import {
  Org,
  Lifecycle,
  StateAggregator,
  SandboxEvents,
  // SfdxConfigAggregator,
  // OrgConfigProperties,
  // ConfigAggregator,
  SandboxProcessObject,
  Logger,
} from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { shouldThrow, TestContext } from '@salesforce/core/lib/testSetup';

import { assert, expect, config } from 'chai';
import { Config as IConfig } from '@oclif/core';
import { OrgCloneCommand } from '../../../../src/commands/force/org/clone';
import * as requestFunctions from '../../../../src/shared/sandboxRequest';

config.truncateThreshold = 0;

describe('org:clone', () => {
  const $$ = new TestContext();
  beforeEach(async () => {
    $$.stubAliases({});
    await $$.stubConfig({});
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    stubMethod($$.SANDBOX, fs.promises, 'stat').resolves({ isFile: () => true });
  });
  afterEach(() => {
    $$.restore();
  });

  const sandboxName = 'my-sandbox';
  const sandboxAlias = 'my-sandbox-alias';
  const authUserName = 'my-user';
  const sandboxProcessObj: SandboxProcessObject = {
    // attributes: {
    //   type: 'SandboxProcess',
    //   url: '/services/data/v54.0/tooling/sobjects/SandboxProcess/0GR4p000000HQG4GAO',
    // },
    Id: '0GR4p000000HQG4GAO',
    Status: 'Completed',
    SandboxName: sandboxName,
    SandboxInfoId: '0GQ4p000000HOL2GAO',
    LicenseType: 'DEVELOPER',
    CreatedDate: '2022-03-02T15:30:32.000+0000',
    CopyProgress: 100,
    SandboxOrganization: '00D2f0000008gzD',
    // SourceId: null,
    // Description: null,
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

  const statusEvent = {
    sandboxProcessObj,
    interval: 1,
    retries: 0,
    waitingOnAuth: false,
  };

  // stubs
  let uxTableStub: sinon.SinonStub;
  let uxStyledHeaderStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  let requestStub: sinon.SinonStub;
  // let aliasSetStub: sinon.SinonSpy;
  // let configSetStub: sinon.SinonStub;
  // let configWriteStub: sinon.SinonStub;
  let onStub: sinon.SinonStub;
  // let readJsonDefFileStub: sinon.SinonStub;
  let cloneSandboxStub: sinon.SinonStub;
  // let configAggregatorStub;

  const runCloneCommand = async (params: string[], fails?: boolean): Promise<SandboxProcessObject> => {
    const cmd = new OrgCloneCommand(params, {} as IConfig);
    // stubs to make file.exists work

    cloneSandboxStub = fails
      ? $$.SANDBOX.stub(Org.prototype, 'cloneSandbox').rejects(new Error('MyError'))
      : $$.SANDBOX.stub(Org.prototype, 'cloneSandbox').resolves(sandboxProcessObj);

    // configSetStub = $$.SANDBOX.stub().returns(true);
    // configWriteStub = $$.SANDBOX.stub().resolves(true);
    // const configAggregatorStubOptions = {
    //   getGlobalConfig: () => ({
    //     set: configSetStub,
    //     write: configWriteStub,
    //   }),
    // };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    // cmd.setConfigAggregator(configAggregatorStub);
    if (!fails) {
      onStub = $$.SANDBOX.stub()
        .callsArgWith(1, sandboxProcessObj)
        .callsArgWith(1, statusEvent)
        .callsArgWith(1, resultObject);
    } else {
      onStub = $$.SANDBOX.stub().callsFake((event, cb) => {
        expect(event).to.exist;
        expect(cb).to.be.a('function');
      });
    }
    stubMethod($$.SANDBOX, Lifecycle, 'getInstance').returns({
      on: onStub,
    });
    uxTableStub = stubMethod($$.SANDBOX, cmd, 'table');
    uxLogStub = stubMethod($$.SANDBOX, cmd, 'log');
    uxStyledHeaderStub = stubMethod($$.SANDBOX, cmd, 'styledHeader');
    return cmd.run();
  };

  describe('passes expected arguments to sandboxRequest', () => {
    const defFileName = 'defFile.json';

    it('file', async () => {
      requestStub = stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({});
      await runCloneCommand(['-t', 'sandbox', '-u', 'DevHub', '-f', defFileName]);
      expect(requestStub.firstCall.args[0]).equal(true);
      expect(requestStub.firstCall.args[1]).equal(defFileName);
      assert(requestStub.firstCall.args[2] instanceof Logger);
      expect(requestStub.firstCall.args[3]).deep.equal({});
    });
    it('file + varargs', async () => {
      requestStub = stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({});
      await runCloneCommand(['-t', 'sandbox', '-u', 'DevHub', '-f', defFileName, 'var1=foo']);
      expect(requestStub.firstCall.args[0]).equal(true);
      expect(requestStub.firstCall.args[1]).equal(defFileName);
      assert(requestStub.firstCall.args[2] instanceof Logger);
      expect(requestStub.firstCall.args[3]).deep.equal({ var1: 'foo' });
    });
  });
  it('will return sandbox process object', async () => {
    requestStub = stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({
      sandboxReq: { SandboxName: sandboxName },
      srcSandboxName: 'TheOriginal',
    });
    const defFileName = 'defFile.json';
    const res = await runCloneCommand(['-t', 'sandbox', '-u', 'DevHub', '-f', defFileName]);
    expect(uxStyledHeaderStub.calledOnce).to.be.true;

    expect(uxTableStub.firstCall.args[0].length).to.be.equal(12);
    // one deprecated flag warning for -u, plus 3 sandbox events
    expect(uxLogStub.callCount).to.be.equal(4);
    expect(uxLogStub.callCount).to.be.equal(4);
    const stateAggregator = await StateAggregator.getInstance();
    expect(stateAggregator.aliases.getAll()).to.deep.equal({});
    // expect(configSetStub.callCount).to.be.equal(0);
    // expect(configWriteStub.callCount).to.be.equal(0);
    expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
    expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(3);
    expect(cloneSandboxStub.firstCall.firstArg).to.deep.equal({
      SandboxName: sandboxName,
    });
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('will set alias and default username', async () => {
    requestStub = stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({
      sandboxReq: { SandboxName: sandboxName, authUserName },
      srcSandboxName: 'TheOriginal',
    });
    const defFileName = 'defFile.json';
    const res = await runCloneCommand(['-t', 'sandbox', '-u', 'DevHub', '-f', defFileName, '-a', sandboxAlias, '-s']);
    expect(uxStyledHeaderStub.calledOnce).to.be.true;

    expect(uxTableStub.firstCall.args[0].length).to.be.equal(12);
    // one deprecated flag warning for -u, plus 3 sandbox events
    expect(uxLogStub.callCount).to.be.equal(4);
    expect(uxLogStub.callCount).to.be.equal(4);

    const stateAggregator = await StateAggregator.getInstance();
    expect(stateAggregator.aliases.getAll()).to.deep.equal({ [sandboxAlias]: authUserName });

    expect($$.stubs.configWrite.callCount).to.equal(1);
    expect(uxStyledHeaderStub.callCount).to.equal(1);
    expect(uxTableStub.firstCall.args[0].length).to.be.equal(12);
    expect(uxLogStub.callCount).to.be.equal(4);

    // expect($$.configAggregator?.getGlobalConfig()?.get(OrgConfigProperties.TARGET_ORG)).to.equal(authUserName);
    // expect(configSetStub.callCount).to.be.equal(1);

    // expect(configSetStub.firstCall.args[0]).to.be.equal(OrgConfigProperties.TARGET_ORG);
    // expect(configSetStub.firstCall.args[1]).to.be.equal(authUserName);
    expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
    expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
    expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
    expect(onStub.callCount).to.be.equal(3);
    expect(cloneSandboxStub.firstCall.firstArg).to.deep.equal({
      authUserName,
      SandboxName: sandboxName,
    });
    //   expect(configWriteStub.calledOnce).to.be.true;
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('cloneSandbox fails and wont set alias or default username', async () => {
    requestStub = stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({
      sandboxReq: { SandboxName: sandboxName },
      srcSandboxName: 'TheOriginal',
    });
    try {
      await shouldThrow(
        runCloneCommand(['-t', 'sandbox', '-u', 'DevHub', '-f', 'sandbox-def.json', '-a', sandboxAlias, '-s'], true)
      );
    } catch (e) {
      assert(e instanceof Error);
      expect(e.name === 'MyError');
      expect(uxStyledHeaderStub.calledOnce).to.be.false;
      expect(uxTableStub.calledOnce).to.be.false;
      // the deprecation warning
      expect(uxLogStub.callCount).to.be.equal(1);
      //     expect(configSetStub.callCount).to.be.equal(0);
      const stateAggregator = await StateAggregator.getInstance();
      expect(stateAggregator.aliases.getAll()).to.deep.equal({});

      expect(onStub.firstCall.firstArg).to.be.equal(SandboxEvents.EVENT_ASYNC_RESULT);
      expect(onStub.secondCall.firstArg).to.be.equal(SandboxEvents.EVENT_STATUS);
      expect(onStub.thirdCall.firstArg).to.be.equal(SandboxEvents.EVENT_RESULT);
      expect(onStub.callCount).to.be.equal(3);
      expect(cloneSandboxStub.firstCall.firstArg).to.deep.equal({
        // license type is not set in sandbox cloning
        SandboxName: sandboxName,
      });
      //     expect(configWriteStub.calledOnce).to.be.false;
    }
  });
});
