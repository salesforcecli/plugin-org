/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import * as chalk from 'chalk';
import { StandardColors } from '@salesforce/sf-plugins-core';
const compareStages = ([, aValue], [, bValue]): number =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  aValue.index - bValue.index;
export const boldPurple = chalk.rgb(157, 129, 221).bold;

export enum State {
  'inProgress' = 'inProgress',
  'completed' = 'completed',
  'failed' = 'failed',
  'unknown' = 'unknown',
}

export type StageAttributes = {
  state: State;
  char: string;
  color: chalk.Chalk;
  index?: number;
  visited: boolean;
};

export const StateConstants: { [stage: string]: StageAttributes } = {
  inProgress: { color: boldPurple, char: '…', visited: false, state: State.inProgress },
  completed: { color: StandardColors.success, char: '✓', visited: false, state: State.completed },
  failed: { color: chalk.bold.red, char: '✖', visited: false, state: State.failed },
  unknown: { color: chalk.dim, char: '…', visited: false, state: State.unknown },
};

export type Stage = {
  [stage: string]: StageAttributes;
};

export abstract class StagedProgress<T> {
  private dataForTheStatus: T;
  private theStages: Stage;
  private currentStage: string;
  private previousStage: string;
  public constructor(stages: string[]) {
    this.theStages = stages
      .map((stage, index) => ({
        [stage]: { ...StateConstants[State.unknown], index: (index + 1) * 10 },
      }))
      .reduce<Stage>((m, b) => Object.assign(m, b), {});
  }

  public get statusData(): T {
    return this.dataForTheStatus;
  }
  public set statusData(statusData: T) {
    this.dataForTheStatus = statusData;
  }
  public formatStages(): string {
    return Object.entries(this.theStages)
      .sort(compareStages)
      .map(([stage, stageState]) => stageState.color(`${stageState.char} - ${stage}`))
      .join(os.EOL);
  }

  public transitionStages(currentStage: string, newState?: State): void {
    currentStage = this.mapCurrentStage(currentStage);
    if (this.previousStage && this.previousStage !== currentStage) {
      this.updateStages(this.previousStage, State.completed);
    }

    // mark all previous stages as visited and completed
    this.markPreviousStagesAsCompleted(currentStage);

    this.previousStage = currentStage;
    this.currentStage = currentStage;
    this.updateStages(currentStage, newState);
  }

  public markPreviousStagesAsCompleted(currentStage?: string): void {
    currentStage = this.mapCurrentStage(currentStage);
    Object.entries(this.theStages).forEach(([stage, stageState]) => {
      if (!currentStage || stageState.index < this.theStages[currentStage].index) {
        this.updateStages(stage, State.completed);
      }
    });
  }

  public updateCurrentStage(newState: State): void {
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
    this.theStages[currentStage].state = newState || State.inProgress;
    this.theStages[currentStage].char = StateConstants[this.theStages[currentStage].state].char;
    this.theStages[currentStage].color = StateConstants[newState.toString()].color;
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
