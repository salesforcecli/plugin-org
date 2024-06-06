/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import os from 'node:os';
import { StatusEvent, ResultEvent, SandboxProcessObject } from '@salesforce/core';
import { Ux } from '@salesforce/sf-plugins-core/Ux';
import { getClockForSeconds } from '../shared/timeUtils.js';
import { StagedProgress } from './stagedProgress.js';
import { isDefined } from './utils.js';

const columns: Ux.Table.Columns<{ key: string; value: string }> = {
  key: { header: 'Field' },
  value: { header: 'Value' },
};

export type SandboxProgressData = {
  id: string;
  status: string;
  percentComplete?: number;
  remainingWaitTime: number;
  remainingWaitTimeHuman: string;
};

export type SandboxStatusData = {
  sandboxUsername: string;
  sandboxProgress: SandboxProgressData;
  sandboxProcessObj?: SandboxProcessObject | undefined;
};

export type SandboxProgressConfig = {
  stageNames?: string[];
  action?: 'Create' | 'Refresh' | 'Create/Refresh';
};

export class SandboxProgress extends StagedProgress<SandboxStatusData> {
  public action: SandboxProgressConfig['action'];

  public constructor(config?: SandboxProgressConfig) {
    const stageNames = config?.stageNames ?? ['Pending', 'Processing', 'Activating', 'Authenticating'];
    super(stageNames);
    this.action = config?.action ?? 'Create/Refresh';
  }
  // eslint-disable-next-line class-methods-use-this
  public getLogSandboxProcessResult(result: ResultEvent): string {
    const { sandboxProcessObj } = result;
    const sandboxReadyForUse = `Sandbox ${sandboxProcessObj.SandboxName}(${sandboxProcessObj.Id}) is ready for use.`;
    return sandboxReadyForUse;
  }

  // eslint-disable-next-line class-methods-use-this
  public getSandboxProgress(
    // sometimes an undefined sandboxRes is passed in
    event: StatusEvent | (Omit<ResultEvent, 'sandboxRes'> & { sandboxRes?: ResultEvent['sandboxRes'] })
  ): SandboxProgressData {
    const waitingOnAuth = 'waitingOnAuth' in event ? event.waitingOnAuth : false;
    const { sandboxProcessObj } = event;
    const waitTimeInSec = 'remainingWait' in event ? event.remainingWait ?? 0 : 0;

    const sandboxIdentifierMsg = `${sandboxProcessObj.SandboxName}(${sandboxProcessObj.Id})`;

    return {
      id: sandboxIdentifierMsg,
      status: waitingOnAuth || sandboxProcessObj.Status === 'Completed' ? 'Authenticating' : sandboxProcessObj.Status,
      percentComplete: sandboxProcessObj.CopyProgress,
      remainingWaitTime: waitTimeInSec,
      remainingWaitTimeHuman: waitTimeInSec === 0 ? '' : `${getClockForSeconds(waitTimeInSec)} until timeout.`,
    };
  }

  public formatProgressStatus(withClock = true): string {
    const table = getSandboxTableAsText(undefined, this.statusData?.sandboxProcessObj).join(os.EOL);
    return [
      withClock && this.statusData
        ? `${getClockForSeconds(this.statusData.sandboxProgress.remainingWaitTime)} until timeout. ${
            this.statusData.sandboxProgress.percentComplete
          }%`
        : undefined,
      table,
      '---------------------',
      `Sandbox ${this.action} Stages`,
      this.formatStages(),
    ]
      .filter(isDefined)
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

export const getTableDataFromProcessObj = (
  sandboxProcessObj: SandboxProcessObject,
  authUserName?: string | undefined
): Array<{ key: string; value: string | number }> => [
  { key: 'Id', value: sandboxProcessObj.Id },
  { key: 'SandboxName', value: sandboxProcessObj.SandboxName },
  { key: 'Status', value: sandboxProcessObj.Status },
  { key: 'LicenseType', value: sandboxProcessObj.LicenseType },
  { key: 'SandboxInfoId', value: sandboxProcessObj.SandboxInfoId },
  { key: 'Created Date', value: sandboxProcessObj.CreatedDate },
  { key: 'CopyProgress', value: `${sandboxProcessObj.CopyProgress}%` },
  ...(sandboxProcessObj.SourceId ? [{ key: 'SourceId', value: sandboxProcessObj.SourceId }] : []),
  ...(sandboxProcessObj.SandboxOrganization
    ? [{ key: 'SandboxOrg', value: sandboxProcessObj.SandboxOrganization }]
    : []),
  ...(sandboxProcessObj.ApexClassId ? [{ key: 'ApexClassId', value: sandboxProcessObj.ApexClassId }] : []),
  ...(sandboxProcessObj.Description ? [{ key: 'Description', value: sandboxProcessObj.Description }] : []),
  ...(authUserName ? [{ key: 'Authorized Sandbox Username', value: authUserName }] : []),
];

export const getSandboxTableAsText = (sandboxUsername?: string, sandboxProgress?: SandboxProcessObject): string[] => {
  if (!sandboxProgress) {
    return [];
  }
  const tableRows: string[] = [];
  new Ux().table(getTableDataFromProcessObj(sandboxProgress, sandboxUsername), columns, {
    printLine: (s: string): void => {
      tableRows.push(s);
    },
  });
  return tableRows;
};
