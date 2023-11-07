/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Lifecycle,
  Messages,
  Org,
  SandboxEvents,
  SandboxProcessObject,
  AuthFields,
  SandboxRequestCacheEntry,
  SfError,
} from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import sinon from 'sinon';
import { expect, config } from 'chai';
import { OrgAccessor } from '@salesforce/core/lib/stateAggregator/index.js';
import { stubSfCommandUx, stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import ResumeSandbox from '../../../src/commands/org/resume/sandbox.js';
config.truncateThreshold = 0;

const prodOrgUsername = 'resumeSandbox@test.org';
const sandboxName = 'TestSbx';
const fakeOrg: AuthFields = {
  orgId: '00Dsomefakeorg1',
  instanceUrl: 'https://some.fake.org',
  username: prodOrgUsername,
};

const sandboxProcessObj: SandboxProcessObject = {
  Id: '0GR4p000000U8EMXXX',
  Status: 'Completed',
  SandboxName: sandboxName,
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

const sandboxRequestData: SandboxRequestCacheEntry = {
  prodOrgUsername,
  sandboxRequest: {},
  sandboxProcessObject: {
    SandboxName: sandboxName,
  },
  setDefault: false,
};

describe('[org resume sandbox]', () => {
  Messages.importMessagesDirectory(dirname(fileURLToPath(import.meta.url)));
  const messages = Messages.loadMessages('@salesforce/plugin-org', 'sandboxbase');

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    stubMethod(sandbox, OrgAccessor.prototype, 'read').resolves(fakeOrg);
    stubMethod(sandbox, OrgAccessor.prototype, 'write').resolves(fakeOrg);
    sfCommandUxStubs = stubSfCommandUx(sandbox);
    stubUx(sandbox);
    stubSpinner(sandbox);
  });

  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  it('will warn when multiple sandboxes are in a resumable state', async () => {
    stubMethod(sandbox, ResumeSandbox.prototype, 'getSandboxRequestConfig').resolves();
    stubMethod(sandbox, ResumeSandbox.prototype, 'buildSandboxRequestCacheEntry').returns(sandboxRequestData);
    stubMethod(sandbox, ResumeSandbox.prototype, 'createResumeSandboxRequest').returns({
      SandboxName: sandboxName,
    });
    stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
    stubMethod(sandbox, Org.prototype, 'getUsername').returns(prodOrgUsername);
    const inProgSandboxProcessObj = Object.assign({}, sandboxProcessObj, {
      Status: 'In Progress',
      Id: '0GR4p000000U8EMZZZ',
      CopyProgress: 25,
      CreatedDate: '2022-12-07T16:20:21.000+0000',
    });
    stubMethod(sandbox, Org.prototype, 'resumeSandbox').callsFake(async () => {
      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_MULTIPLE_SBX_PROCESSES, [
        inProgSandboxProcessObj,
        sandboxProcessObj,
      ]);
      throw new SfError('sbx create not complete', 'sandboxCreateNotComplete');
    });

    try {
      await ResumeSandbox.run(['-o', prodOrgUsername, '--name', sandboxName]);
      expect(false, 'ResumeSandbox should have thrown sandboxCreateNotComplete');
    } catch (err: unknown) {
      const warningMsg = messages.getMessage('warning.MultipleMatchingSandboxProcesses', [
        sandboxName,
        sandboxProcessObj.Id,
        sandboxProcessObj.Status,
        inProgSandboxProcessObj.Id,
        sandboxProcessObj.Id,
        prodOrgUsername,
      ]);
      expect(sfCommandUxStubs.warn.calledWith(warningMsg)).to.be.true;
      const error = err as SfError;
      expect(error.name).to.equal('sandboxCreateNotComplete');
    }
  });

  afterEach(() => {
    sandbox.restore();
  });
});
