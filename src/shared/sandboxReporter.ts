/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { StatusEvent, ResultEvent } from '@salesforce/core';
import { Duration } from '@salesforce/kit';

export class SandboxReporter {
  public static sandboxProgress(update: StatusEvent): string {
    const { remainingWait, interval, sandboxProcessObj, waitingOnAuth } = update;

    const waitTime: string = SandboxReporter.getSecondsToHuman(remainingWait);
    const waitTimeMsg = `Sleeping ${interval} seconds. Will wait ${waitTime} more before timing out.`;
    const sandboxIdentifierMsg = `${sandboxProcessObj.SandboxName}(${sandboxProcessObj.Id})`;
    const waitingOnAuthMessage: string = waitingOnAuth ? ', waiting on JWT auth' : '';
    const completionMessage = `(${sandboxProcessObj.CopyProgress}% completed${waitingOnAuthMessage})`;

    return `Sandbox request ${sandboxIdentifierMsg} is ${sandboxProcessObj.Status} ${completionMessage}. ${waitTimeMsg}`;
  }

  public static logSandboxProcessResult(
    result: ResultEvent
    // sandboxProcessObj.CopyProgress is a number
  ): { sandboxReadyForUse: string; data: Array<{ key: string; value: string | number | undefined }> } {
    const { sandboxProcessObj, sandboxRes } = result;
    const sandboxReadyForUse = `Sandbox ${sandboxProcessObj.SandboxName}(${sandboxProcessObj.Id}) is ready for use.`;

    const data = [
      { key: 'Id', value: sandboxProcessObj.Id },
      { key: 'SandboxName', value: sandboxProcessObj.SandboxName },
      { key: 'Status', value: sandboxProcessObj.Status },
      { key: 'CopyProgress', value: sandboxProcessObj.CopyProgress },
      { key: 'Description', value: sandboxProcessObj.Description },
      { key: 'LicenseType', value: sandboxProcessObj.LicenseType },
      { key: 'SandboxInfoId', value: sandboxProcessObj.SandboxInfoId },
      { key: 'SourceId', value: sandboxProcessObj.SourceId },
      { key: 'SandboxOrg', value: sandboxProcessObj.SandboxOrganization },
      { key: 'Created Date', value: sandboxProcessObj.CreatedDate },
      { key: 'ApexClassId', value: sandboxProcessObj.ApexClassId },
      { key: 'Authorized Sandbox Username', value: sandboxRes.authUserName },
    ];

    return { sandboxReadyForUse, data };
  }

  private static getSecondsToHuman(waitTimeInSec: number): string {
    const hours = Duration.hours(Math.floor(waitTimeInSec / 3600));
    const minutes = Duration.minutes(Math.floor((waitTimeInSec % 3600) / 60));
    const seconds = Duration.seconds(Math.floor(waitTimeInSec % 60));

    const hDisplay: string = hours.hours > 0 ? hours.toString() + ' ' : '';
    const mDisplay: string = minutes.minutes > 0 ? minutes.toString() + ' ' : '';
    const sDisplay: string = seconds.seconds > 0 ? seconds.toString() : '';

    return (hDisplay + mDisplay + sDisplay).trim();
  }
}
