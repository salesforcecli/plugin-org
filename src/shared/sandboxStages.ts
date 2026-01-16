/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
