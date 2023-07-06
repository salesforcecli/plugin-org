/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Lifecycle, Org, SandboxEvents, SandboxProcessObject, AuthFields } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { expect, config } from 'chai';
import { OrgAccessor } from '@salesforce/core/lib/stateAggregator';
import { stubSfCommandUx, stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import CreateSandbox from '../../../src/commands/org/create/sandbox';

config.truncateThreshold = 0;

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

describe('org:create:sandbox', () => {
  beforeEach(() => {
    // stubMethod(sandbox, OrgAccessor.prototype, 'read').callsFake(async (): Promise<AuthFields> => fakeOrg);
    // stubMethod(sandbox, OrgAccessor.prototype, 'write').callsFake(async (): Promise<AuthFields> => fakeOrg);
    stubMethod(sandbox, OrgAccessor.prototype, 'read').resolves(fakeOrg);
    stubMethod(sandbox, OrgAccessor.prototype, 'write').resolves(fakeOrg);
    sfCommandUxStubs = stubSfCommandUx(sandbox);
    stubUx(sandbox);
    stubSpinner(sandbox);
  });

  const sandbox = sinon.createSandbox();
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  describe('sandbox', () => {
    it('will print the correct message for asyncResult lifecycle event', async () => {
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'getUsername').returns('testProdOrg');
      const createStub = stubMethod(sandbox, Org.prototype, 'createSandbox').callsFake(async () =>
        (async () => {})().catch()
      );

      await CreateSandbox.run(['-o', 'testProdOrg', '--name', 'mysandboxx', '--no-prompt']);

      expect(createStub.firstCall.args[0].SandboxName).includes('mysandboxx');
      expect(createStub.firstCall.args[0].SandboxName.length).equals(10);

      Lifecycle.getInstance().on(SandboxEvents.EVENT_ASYNC_RESULT, async (result) => {
        expect(result).to.deep.equal(sandboxProcessObj);
        expect(sfCommandUxStubs.info.firstCall.firstArg).to.include(sandboxProcessObj.Id);
        return Promise.resolve();
      });

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_ASYNC_RESULT, sandboxProcessObj);
      Lifecycle.getInstance().removeAllListeners(SandboxEvents.EVENT_ASYNC_RESULT);
    });
  });

  afterEach(() => {
    sandbox.restore();
  });
});
