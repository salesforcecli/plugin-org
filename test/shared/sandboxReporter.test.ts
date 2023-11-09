/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, config } from 'chai';
import { StatusEvent, SandboxProcessObject, SandboxUserAuthResponse } from '@salesforce/core';
import { SandboxReporter } from '../../src/shared/sandboxReporter.js';

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

describe('sandboxReporter', () => {
  describe('sandboxProgress', () => {
    it('will calculate the correct human readable message (1h 33min 00seconds seconds left)', () => {
      const data = {
        sandboxProcessObj,
        interval: 30,
        remainingWait: 5580,
        waitingOnAuth: false,
      };
      const res = SandboxReporter.sandboxProgress(data);
      expect(res).to.equal(
        'Sandbox request TestSandbox(0GR4p000000U8EMXXX) is Completed (100% completed). Sleeping 30 seconds. Will wait 1 hour 33 minutes more before timing out.'
      );
    });

    it('will calculate the correct human readable message (5 min 30seconds seconds left)', () => {
      const data: StatusEvent = {
        sandboxProcessObj,
        interval: 30,
        remainingWait: 330,
        waitingOnAuth: false,
      };
      const res = SandboxReporter.sandboxProgress(data);
      expect(res).to.equal(
        'Sandbox request TestSandbox(0GR4p000000U8EMXXX) is Completed (100% completed). Sleeping 30 seconds. Will wait 5 minutes 30 seconds more before timing out.'
      );
    });
  });

  describe('logSandboxProcessResult', () => {
    it('sandboxCreate EVENT_RESULT', () => {
      const sandboxRes: SandboxUserAuthResponse = {
        authCode: 'sandboxTestAuthCode',
        authUserName: 'newSandboxUsername',
        instanceUrl: 'https://login.salesforce.com',
        loginUrl: 'https://productionOrg--createdSandbox.salesforce.com/',
      };

      const data = { sandboxProcessObj, sandboxRes };
      expect(SandboxReporter.logSandboxProcessResult(data)).to.deep.equal({
        sandboxReadyForUse: 'Sandbox TestSandbox(0GR4p000000U8EMXXX) is ready for use.',
        data: [
          {
            key: 'Id',
            value: '0GR4p000000U8EMXXX',
          },
          {
            key: 'SandboxName',
            value: 'TestSandbox',
          },
          {
            key: 'Status',
            value: 'Completed',
          },
          {
            key: 'CopyProgress',
            value: 100,
          },
          {
            key: 'Description',
            value: 'sandbox description',
          },
          {
            key: 'LicenseType',
            value: 'DEVELOPER',
          },
          {
            key: 'SandboxInfoId',
            value: '0GQ4p000000U6sKXXX',
          },
          {
            key: 'SourceId',
            value: '123',
          },
          {
            key: 'SandboxOrg',
            value: '00D2f0000008XXX',
          },
          {
            key: 'Created Date',
            value: '2021-12-07T16:20:21.000+0000',
          },
          {
            key: 'ApexClassId',
            value: '123',
          },
          {
            key: 'Authorized Sandbox Username',
            value: 'newSandboxUsername',
          },
        ],
      });
    });
  });
});
