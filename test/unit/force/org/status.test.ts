/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org, Lifecycle, SandboxProcessObject } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';

import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';

import { Config } from '@oclif/core';
import { OrgStatusCommand } from '../../../../src/commands/force/org/status';

describe('org:status', () => {
  const $$ = new TestContext();

  const sandboxName = 'my-sandbox';
  const sandboxAlias = 'my-sandbox-alias';
  const authUserName = 'my-user';
  const sandboxProcessObj = {
    attributes: {
      type: 'SandboxProcess',
      url: '/services/data/v54.0/tooling/sobjects/SandboxProcess/0GR4p000000HQG4GAO',
    },
    Id: '0GR4p000000HQG4GAO',
    Status: 'Completed',
    SandboxName: sandboxName,
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

  // stubs
  let uxTableStub: sinon.SinonStub;
  let onStub: sinon.SinonStub;
  let testOrg = new MockTestOrgData();

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.stubAliases({});
    await $$.stubConfig({ 'target-org': testOrg.username });
  });
  afterEach(() => {
    $$.restore();
  });

  const runStatusCommand = async (params: string[] = []): Promise<SandboxProcessObject> => {
    const cmd = new OrgStatusCommand(params, {} as Config);

    stubMethod($$.SANDBOX, Org.prototype, 'sandboxStatus').resolves(sandboxProcessObj);
    uxTableStub = $$.SANDBOX.stub(cmd, 'table');
    onStub = $$.SANDBOX.stub().callsArgWith(1, sandboxProcessObj).callsArgWith(1, resultObject);

    stubMethod($$.SANDBOX, Lifecycle, 'getInstance').returns({
      on: onStub,
    });
    return cmd.run();
  };

  it('will return sandbox process object', async () => {
    const res = await runStatusCommand(['--sandboxname', sandboxName]);
    expect(uxTableStub.firstCall.args[0].length).to.equal(12);
    const logs = $$.TEST_LOGGER.getBufferedRecords();
    logs.forEach((line) => {
      expect(line.msg).to.not.include('Set Alias:');
      expect(line.msg).to.not.include('Set defaultUsername');
    });
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('will set alias and defaultusername', async () => {
    const res = await runStatusCommand([
      '--sandboxname',
      sandboxName,
      '--setalias',
      sandboxAlias,
      '--setdefaultusername',
    ]);
    expect(uxTableStub.firstCall.args[0].length).to.equal(12);
    expect(onStub.callCount).to.be.equal(2);

    const logs = $$.TEST_LOGGER.getBufferedRecords();
    expect(logs.some((line) => line.msg.includes('Set Alias:')));
    expect(logs.some((line) => line.msg.includes('Set defaultUsername:')));
    expect(res).to.deep.equal(sandboxProcessObj);
  });

  it('will set default username but not alias', async () => {
    const res = await runStatusCommand(['--sandboxname', sandboxName, '--setdefaultusername']);
    expect(uxTableStub.firstCall.args[0].length).to.equal(12);
    expect(onStub.callCount).to.be.equal(2);

    const logs = $$.TEST_LOGGER.getBufferedRecords();
    logs.forEach((line) => {
      expect(line.msg).to.not.include('Set Alias:');
    });
    expect(logs.some((line) => line.msg.includes('Set defaultUsername:')));
    expect(res).to.deep.equal(sandboxProcessObj);
  });
});
