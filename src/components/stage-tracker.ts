/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Performance } from '@oclif/core/performance';

export type StageStatus = 'pending' | 'current' | 'completed' | 'skipped' | 'failed';

export class StageTracker extends Map<string, StageStatus> {
  public current: string | undefined;
  private markers = new Map<string, ReturnType<typeof Performance.mark>>();

  public constructor(stages: readonly string[] | string[]) {
    super(stages.map((stage) => [stage, 'pending']));
  }

  public set(stage: string, status: StageStatus): this {
    if (status === 'current') {
      this.current = stage;
    }
    return super.set(stage, status);
  }

  public refresh(nextStage: string, opts?: { hasError?: boolean; isStopping?: boolean }): void {
    const stages = [...this.keys()];
    for (const stage of stages) {
      if (this.get(stage) === 'skipped') continue;
      if (this.get(stage) === 'failed') continue;

      // .stop() was called with an error => set the stage to failed
      if (nextStage === stage && opts?.hasError) {
        this.set(stage, 'failed');
        this.stopMarker(stage);
        continue;
      }

      // .stop() was called without an error => set the stage to completed
      if (nextStage === stage && opts?.isStopping) {
        this.set(stage, 'completed');
        this.stopMarker(stage);
        continue;
      }

      // set the current stage
      if (nextStage === stage) {
        this.set(stage, 'current');
        // create a marker for the current stage if it doesn't exist
        if (!this.markers.has(stage)) {
          this.markers.set(stage, Performance.mark('MultiStageComponent', stage.replaceAll(' ', '-').toLowerCase()));
        }

        continue;
      }

      // any stage before the current stage should be marked as skipped if it's still pending
      if (stages.indexOf(stage) < stages.indexOf(nextStage) && this.get(stage) === 'pending') {
        this.set(stage, 'skipped');
        continue;
      }

      // any stage before the current stage should be as completed (if it hasn't been marked as skipped or failed yet)
      if (stages.indexOf(nextStage) > stages.indexOf(stage)) {
        this.set(stage, 'completed');
        this.stopMarker(stage);
        continue;
      }

      // default to pending
      this.set(stage, 'pending');
    }
  }

  private stopMarker(stage: string): void {
    const marker = this.markers.get(stage);
    if (marker && !marker.stopped) {
      marker.stop();
    }
  }
}
