/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { Duration } from '@salesforce/cli-plugins-testkit';
import { SandboxProcessObject, StatusEvent } from '@salesforce/core';
import { SandboxProgress } from '../../src/shared/sandboxProgress';

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

describe('sandbox progress', () => {
  let sandboxProgress: SandboxProgress;
  beforeEach(() => {
    sandboxProgress = new SandboxProgress();
  });
  describe('getSandboxProgress', () => {
    it('will calculate the correct human readable message (1h 33min 00seconds seconds left)', async () => {
      const data: StatusEvent = {
        // 186*30 = 5580 = 1 hour, 33 min, 0 seconds. so 186 attempts left, at a 30 second polling interval
        sandboxProcessObj,
        interval: 30,
        remainingWait: Duration.minutes(93).seconds,
        waitingOnAuth: false,
      };
      const res = sandboxProgress.getSandboxProgress(data);
      expect(res).to.have.property('id', 'TestSandbox(0GR4p000000U8EMXXX)');
      expect(res).to.have.property('status', 'Authenticating');
      expect(res).to.have.property('percentComplete', 100);
      expect(res).to.have.property('remainingWaitTimeHuman', '01:33:00 until timeout.');
    });

    it('will calculate the correct human readable message (5 min 30seconds seconds left)', async () => {
      const data: StatusEvent = {
        sandboxProcessObj,
        interval: 30,
        remainingWait: Duration.minutes(5).seconds + Duration.seconds(30).seconds,
        waitingOnAuth: false,
      };
      const res = sandboxProgress.getSandboxProgress(data);
      expect(res).to.have.property('id', 'TestSandbox(0GR4p000000U8EMXXX)');
      expect(res).to.have.property('status', 'Authenticating');
      expect(res).to.have.property('percentComplete', 100);
      expect(res).to.have.property('remainingWaitTimeHuman', '00:05:30 until timeout.');
    });
  });

  describe('getTableDataFromProcessObj', () => {
    it('getTableDataFromProcessObj should work', () => {
      const tableData = sandboxProgress.getTableDataFromProcessObj('admin@prod.org.sandbox', sandboxProcessObj);
      expect(tableData.find((r) => r.key === 'Authorized Sandbox Username')).to.have.property(
        'value',
        'admin@prod.org.sandbox'
      );
      expect(tableData.find((r) => r.key === 'SandboxInfoId')).to.have.property('value', '0GQ4p000000U6sKXXX');
    });
  });
  describe('getSandboxTableAsText', () => {
    it('getSandboxTableAsText should work', () => {
      const tableData = sandboxProgress.getSandboxTableAsText('admin@prod.org.sandbox', sandboxProcessObj);
      expect(tableData.find((r) => r.includes('Authorized Sandbox Username') && r.includes('admin@prod.org.sandbox')))
        .to.be.ok;
    });
  });
});
