/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MultiStageOutput } from '@oclif/multi-stage-output';
import { SandboxProcessObject } from '@salesforce/core';
import { StageStatus } from 'node_modules/@oclif/multi-stage-output/lib/stage-tracker.js';

type Options = {
  title: string;
  jsonEnabled: boolean;
  refresh: boolean;
};

export class SandboxStages {
  private mso: MultiStageOutput<SandboxProcessObject>;
  private refresh: boolean;

  public constructor({ title, jsonEnabled, refresh = false }: Options) {
    this.refresh = refresh;
    this.mso = new MultiStageOutput<SandboxProcessObject>({
      stages: ['Creating new sandbox', 'Refreshing org', 'Authenticating'],
      title,
      jsonEnabled,
      stageSpecificBlock: [
        {
          get: (data): string | undefined => data?.SandboxName,
          stage: 'Creating new sandbox',
          label: 'Name',
          type: 'dynamic-key-value',
        },
        {
          get: (data): string | undefined => data?.Id,
          stage: 'Creating new sandbox',
          label: 'ID',
          type: 'dynamic-key-value',
        },
      ],
      postStagesBlock: [
        {
          label: 'Status',
          get: (data): string | undefined => data?.Status,
          type: 'dynamic-key-value',
          bold: true,
        },
        {
          label: 'Copy progress',
          get: (data): string | undefined => `${data?.CopyProgress ?? 0}%`,
          type: 'dynamic-key-value',
        },
      ],
    });
  }

  public start(): void {
    if (this.refresh) {
      this.mso.skipTo('Refreshing org');
    } else {
      this.mso.goto('Creating new sandbox');
    }
  }

  public auth(): void {
    this.mso.goto('Authenticating');
  }

  public update(data: SandboxProcessObject): void {
    this.mso.updateData(data);
  }

  public stop(finalStatus?: StageStatus): void {
    this.mso.stop(finalStatus);
  }
}
