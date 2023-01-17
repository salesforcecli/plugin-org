/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { scratchOrgLifecycleStages, ScratchOrgInfo } from '@salesforce/core';
import { expect } from 'chai';
import {
  buildStatus,
  formatCompletedStage,
  formatCurrentStage,
  formatFutureStage,
  formatOrgId,
  formatRequest,
  formatStage,
  formatUsername,
} from '../../../../src/shared/scratchOrgOutput';

describe('human output', () => {
  describe('stage formatter', () => {
    it('highlights 1st stage with color, remaining are dimmed', () => {
      const result = formatStage(scratchOrgLifecycleStages[0]);
      expect(result).includes(formatCurrentStage(scratchOrgLifecycleStages[0]));
      scratchOrgLifecycleStages.slice(1).forEach((stage) => {
        expect(result).includes(formatFutureStage(stage));
      });
    });
    it('highlights other stage with color and previous as green', () => {
      const result = formatStage(scratchOrgLifecycleStages[1]);
      expect(result).includes(formatCurrentStage(scratchOrgLifecycleStages[1]));
      expect(result).includes(formatCompletedStage(scratchOrgLifecycleStages[0]));
      scratchOrgLifecycleStages.slice(2).forEach((stage) => {
        expect(result).includes(formatFutureStage(stage));
      });
    });
  });
  describe('overall output', () => {
    const baseUrl = 'https://ut.my.salesforce.com';
    const scratchOrgInfo: ScratchOrgInfo = {
      Id: '2SR3u0000008VBXGA2',
      ScratchOrg: '00D0x000000Lf9E',
      SignupUsername: 'test-uluqhj7qu9k2@example.com',
      LoginUrl: 'https://ut.my.salesforce.com',
      AuthCode: 'x',
      Snapshot: null,
      Username: 'test-uluqhj7qu9k2@example.com',
      SignupEmail: 'x',
      Status: 'Active',
      SignupInstance: '',
    };

    it('shows all fields when all data is present', () => {
      const output = buildStatus(
        { stage: scratchOrgLifecycleStages[scratchOrgLifecycleStages.length - 1], scratchOrgInfo },
        baseUrl
      );
      expect(output).includes(`RequestId: ${formatRequest(baseUrl, scratchOrgInfo.Id)}`);
      expect(output).includes(`OrgId: ${formatOrgId(scratchOrgInfo.ScratchOrg)}`);
      expect(output).includes(`Username: ${formatUsername(scratchOrgInfo.SignupUsername)}`);
      expect(output).not.includes('}');
      expect(output).not.includes('{');
    });

    it('still shows all field names when no data is present', () => {
      const output = buildStatus({ stage: scratchOrgLifecycleStages[0] }, baseUrl);
      expect(output).includes('RequestId: ');
      expect(output).includes('OrgId: ');
      expect(output).includes('RequestId: ');
    });
  });
});
