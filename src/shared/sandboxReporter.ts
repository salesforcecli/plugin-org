/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SandboxProcessObject, SandboxUserAuthResponse } from '@salesforce/core';
import { Duration } from '@salesforce/kit';

export class SandboxReporter {
  public static sandboxProgress(update: {
    sandboxProcessObject: SandboxProcessObject;
    pollIntervalInSecond: number;
    retriesLeft: number;
    waitingOnAuth: boolean;
  }): string {
    const { retriesLeft, pollIntervalInSecond, sandboxProcessObject, waitingOnAuth } = update;
    const waitTimeInSec: number = retriesLeft * pollIntervalInSecond;

    const waitTime: string = Duration.seconds(waitTimeInSec).seconds.toString();
    const waitTimeMsg = `Sleeping ${pollIntervalInSecond} seconds. Will wait ${waitTime} more before timing out.`;
    const sandboxIdentifierMsg = `${sandboxProcessObject.SandboxName}(${sandboxProcessObject.Id})`;
    const waitingOnAuthMessage: string = waitingOnAuth ? ', waiting on JWT auth' : '';
    const completionMessage = `(${sandboxProcessObject.CopyProgress}% completed${waitingOnAuthMessage})`;

    return `Sandbox request ${sandboxIdentifierMsg} is ${sandboxProcessObject.Status} ${completionMessage}. ${waitTimeMsg}`;
  }

  public static logSandboxProcessResult(
    processRecord: SandboxProcessObject,
    sandboxRes: SandboxUserAuthResponse
    // processRecord.CopyProgress is a number
  ): { sandboxReadyForUse: string; data: Array<{ key: string; value: string | number }> } {
    const sandboxReadyForUse = `Sandbox ${processRecord.SandboxName}(${processRecord.Id}) is ready for use.`;

    const data = [
      { key: 'Id', value: processRecord.Id },
      { key: 'SandboxName', value: processRecord.SandboxName },
      { key: 'Status', value: processRecord.Status },
      { key: 'CopyProgress', value: processRecord.CopyProgress },
      { key: 'Description', value: processRecord.Description },
      { key: 'LicenseType', value: processRecord.LicenseType },
      { key: 'SandboxInfoId', value: processRecord.SandboxInfoId },
      { key: 'SourceId', value: processRecord.SourceId },
      { key: 'SandboxOrg', value: processRecord.SandboxOrganization },
      { key: 'Created Date', value: processRecord.CreatedDate },
      { key: 'ApexClassId', value: processRecord.ApexClassId },
      { key: 'Authorized Sandbox Username', value: sandboxRes.authUserName },
    ];

    return { sandboxReadyForUse, data };
  }
}
