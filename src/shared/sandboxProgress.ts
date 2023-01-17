/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { StatusEvent, ResultEvent, SandboxProcessObject } from '@salesforce/core';
import { Ux } from '@salesforce/sf-plugins-core/lib/ux';
import { CliUx } from '@oclif/core';
import { getClockForSeconds } from '../utils/timeUtils';
import { StagedProgress } from './stagedProgress';

const columns: Ux.Table.Columns<{ key: string; value: string }> = {
  key: { header: 'Field' },
  value: { header: 'Value' },
};

export type SandboxProgressData = {
  id: string;
  status: string;
  percentComplete: number;
  remainingWaitTime: number;
  remainingWaitTimeHuman: string;
};

export type SandboxStatusData = {
  sandboxUsername: string;
  sandboxProgress: SandboxProgressData;
  sandboxProcessObj?: SandboxProcessObject | undefined;
};

export class SandboxProgress extends StagedProgress<SandboxStatusData> {
  public constructor(stageNames: string[] = ['Pending', 'Processing', 'Activating', 'Authenticating']) {
    super(stageNames);
  }
  // eslint-disable-next-line class-methods-use-this
  public getLogSandboxProcessResult(result: ResultEvent): string {
    const { sandboxProcessObj } = result;
    const sandboxReadyForUse = `Sandbox ${sandboxProcessObj.SandboxName}(${sandboxProcessObj.Id}) is ready for use.`;
    return sandboxReadyForUse;
  }

  // eslint-disable-next-line class-methods-use-this
  public getTableDataFromProcessObj(
    authUserName: string,
    sandboxProcessObj: SandboxProcessObject
  ): Array<{ key: string; value: string | number }> {
    return [
      { key: 'Id', value: sandboxProcessObj.Id },
      { key: 'SandboxName', value: sandboxProcessObj.SandboxName },
      { key: 'Status', value: sandboxProcessObj.Status },
      { key: 'CopyProgress', value: `${sandboxProcessObj.CopyProgress}%` },
      { key: 'Description', value: sandboxProcessObj.Description },
      { key: 'LicenseType', value: sandboxProcessObj.LicenseType },
      { key: 'SandboxInfoId', value: sandboxProcessObj.SandboxInfoId },
      { key: 'SourceId', value: sandboxProcessObj.SourceId },
      { key: 'SandboxOrg', value: sandboxProcessObj.SandboxOrganization },
      { key: 'Created Date', value: sandboxProcessObj.CreatedDate },
      { key: 'ApexClassId', value: sandboxProcessObj.ApexClassId },
      { key: 'Authorized Sandbox Username', value: authUserName },
    ].filter((v) => !!v.value);
  }

  // eslint-disable-next-line class-methods-use-this
  public getSandboxProgress(event: StatusEvent | ResultEvent): SandboxProgressData {
    const statusUpdate = event as StatusEvent;
    const waitingOnAuth = statusUpdate.waitingOnAuth ?? false;
    const { sandboxProcessObj } = event;
    const waitTimeInSec = statusUpdate.remainingWait ?? 0;

    const sandboxIdentifierMsg = `${sandboxProcessObj.SandboxName}(${sandboxProcessObj.Id})`;

    return {
      id: sandboxIdentifierMsg,
      status: waitingOnAuth || sandboxProcessObj.Status === 'Completed' ? 'Authenticating' : sandboxProcessObj.Status,
      percentComplete: sandboxProcessObj.CopyProgress,
      remainingWaitTime: waitTimeInSec,
      remainingWaitTimeHuman: waitTimeInSec === 0 ? '' : `${getClockForSeconds(waitTimeInSec)} until timeout.`,
    };
  }

  public getSandboxTableAsText(sandboxUsername: string, sandboxProgress?: SandboxProcessObject): string[] {
    if (!sandboxProgress) {
      return [];
    }
    const tableRows: string[] = [];
    CliUx.ux.table(this.getTableDataFromProcessObj(sandboxUsername, sandboxProgress), columns, {
      printLine: (s: string): void => {
        tableRows.push(s);
      },
    });
    return tableRows;
  }

  public formatProgressStatus(withClock = true): string {
    const table = this.getSandboxTableAsText(undefined, this.statusData.sandboxProcessObj).join(os.EOL);
    return [
      withClock
        ? `${getClockForSeconds(this.statusData.sandboxProgress.remainingWaitTime)} until timeout. ${
            this.statusData.sandboxProgress.percentComplete
          }%`
        : undefined,
      table,
      '---------------------',
      'Sandbox Create Stages',
      this.formatStages(),
    ]
      .filter((line) => line)
      .join(os.EOL);
  }
  // eslint-disable-next-line class-methods-use-this
  protected mapCurrentStage(currentStage: string): string {
    switch (currentStage) {
      case 'Pending Remote Creation':
        return 'Pending';
      case 'Remote Sandbox Created':
        return 'Pending';
      case 'Completed':
        return 'Authenticating';
      default:
        return currentStage;
    }
  }
}
