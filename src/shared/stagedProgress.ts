/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import os from 'node:os';
import ansis, { type Ansis } from 'ansis';
import { StandardColors } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';

const compareStages = ([, aValue]: [string, StageAttributes], [, bValue]: [string, StageAttributes]): number =>
  aValue.index - bValue.index;

export const boldPurple = ansis.rgb(157, 129, 221).bold;

export type State = 'inProgress' | 'completed' | 'failed' | 'unknown';

export type StageAttributes = {
  state: State;
  char: string;
  color: Ansis;
  index: number;
  visited: boolean;
};

export const StateConstants: { [stage: string]: Omit<StageAttributes, 'index'> } = {
  inProgress: { color: boldPurple, char: '…', visited: false, state: 'inProgress' },
  completed: { color: StandardColors.success, char: '✓', visited: false, state: 'completed' },
  failed: { color: ansis.bold.red, char: '✖', visited: false, state: 'failed' },
  unknown: { color: ansis.dim, char: '…', visited: false, state: 'unknown' },
};

export type Stage = {
  [stage: string]: StageAttributes;
};

export abstract class StagedProgress<T> {
  private dataForTheStatus: T | undefined;
  private theStages: Stage;
  private currentStage?: string;
  private previousStage?: string;
  public constructor(stages: string[]) {
    this.theStages = stages
      .map((stage, index) => ({
        [stage]: { ...StateConstants['unknown'], index: (index + 1) * 10 },
      }))
      .reduce<Stage>((m, b) => Object.assign(m, b), {});
  }

  public get statusData(): T | undefined {
    return this.dataForTheStatus;
  }
  public set statusData(statusData: T | undefined) {
    this.dataForTheStatus = statusData;
  }

  public formatStages(): string {
    return Object.entries(this.theStages)
      .sort(compareStages)
      .map(([stage, stageState]) => stageState.color(`${stageState.char} - ${stage}`))
      .join(os.EOL);
  }

  public transitionStages(currentStage: string, newState: State): void {
    currentStage = this.mapCurrentStage(currentStage);
    if (this.previousStage && this.previousStage !== currentStage) {
      this.updateStages(this.previousStage, 'completed');
    }

    // mark all previous stages as visited and completed
    this.markPreviousStagesAsCompleted(currentStage);

    this.previousStage = currentStage;
    this.currentStage = currentStage;
    this.updateStages(currentStage, newState);
  }

  public markPreviousStagesAsCompleted(currentStage?: string): void {
    if (currentStage) {
      currentStage = this.mapCurrentStage(currentStage);
    }
    Object.entries(this.theStages).forEach(([stage, stageState]) => {
      if (!currentStage || stageState.index < (this.theStages[currentStage]?.index ?? 0)) {
        this.updateStages(stage, 'completed');
      }
    });
  }

  public updateCurrentStage(newState: State): void {
    if (!this.currentStage) {
      throw new SfError('transitionStages must be called before updateCurrentStage');
    }
    this.updateStages(this.currentStage, newState);
  }

  public updateStages(currentStage: string, newState?: State): void {
    currentStage = this.mapCurrentStage(currentStage);
    if (!this.theStages[currentStage]) {
      const sortedEntries = Object.entries(this.theStages).sort(compareStages);
      const visitedEntries = sortedEntries.filter(([, stageState]) => stageState.visited);
      const [, lastState] = visitedEntries.length
        ? visitedEntries[visitedEntries.length - 1]
        : ['', { state: StateConstants.unknown.state, index: 0, visited: true }];
      const newEntry = {
        [currentStage]: { state: StateConstants.unknown.state, visited: true, index: lastState.index + 1 },
      };
      this.theStages = Object.assign(this.theStages, newEntry);
    }
    this.theStages[currentStage].visited = true;
    this.theStages[currentStage].state = newState ?? 'inProgress';
    this.theStages[currentStage].char = StateConstants[this.theStages[currentStage].state].char;
    if (newState) {
      this.theStages[currentStage].color = StateConstants[newState.toString()].color;
    }
  }

  public getStages(): Stage {
    return this.theStages;
  }

  // eslint-disable-next-line class-methods-use-this
  protected mapCurrentStage(currentStage: string): string {
    return currentStage;
  }

  public abstract formatProgressStatus(withClock: boolean): string;
}
