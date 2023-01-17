/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as chalk from 'chalk';
import { StagedProgress, State, StateConstants } from '../../src/shared/stagedProgress';
import { SandboxStatusData } from '../../src/shared/sandboxProgress';

class TestStagedProgress extends StagedProgress<SandboxStatusData> {
  // eslint-disable-next-line class-methods-use-this
  public formatProgressStatus(): string {
    return '';
  }
}

describe('stagedProgress', () => {
  let stagedProgress: TestStagedProgress;
  describe('updateStages', () => {
    beforeEach(() => {
      stagedProgress = new TestStagedProgress(['Pending', 'Processing', 'Activating', 'Completed', 'Authenticating']);
    });
    it('should update existing stage', () => {
      stagedProgress.updateStages('Pending', State.failed);
      const pendingStage = stagedProgress.getStages()['Pending'];
      expect(pendingStage).to.be.ok;
      expect(pendingStage.state).to.equal(State.failed);
    });
    it('should insert new stage at beginning of stages', () => {
      stagedProgress.updateStages('Creating', State.inProgress);
      const creatingStage = stagedProgress.getStages()['Creating'];
      const pendingStage = stagedProgress.getStages()['Pending'];
      expect(creatingStage).to.be.ok;
      expect(creatingStage.state).to.equal(State.inProgress);
      expect(creatingStage.index).to.be.lessThan(pendingStage.index);
    });
    it('should insert new stage at end of stages', () => {
      const stages = stagedProgress.getStages();
      Object.keys(stages).forEach((stage) => {
        stages[stage].visited = true;
        stages[stage].state = State.completed;
      });
      stagedProgress.updateStages('Past the End', State.inProgress);
      const pastTheEnd = stagedProgress.getStages()['Past the End'];
      const authenticatingStage = stagedProgress.getStages()['Authenticating'];
      expect(pastTheEnd).to.be.ok;
      expect(pastTheEnd.state).to.equal(State.inProgress);
      expect(pastTheEnd.index).to.be.greaterThan(authenticatingStage.index);
    });
    it('should insert new stage after Processing', () => {
      const stages = stagedProgress.getStages();
      Object.keys(stages).forEach((stage) => {
        if (['Pending', 'Processing'].includes(stage)) {
          stages[stage].visited = true;
          stages[stage].state = State.completed;
        }
      });
      stagedProgress.updateStages('After Processing', State.inProgress);
      const afterProcessStage = stagedProgress.getStages()['After Processing'];
      const processingStage = stagedProgress.getStages()['Processing'];
      expect(afterProcessStage).to.be.ok;
      expect(afterProcessStage.state).to.equal(State.inProgress);
      expect(afterProcessStage.index).to.be.equal(processingStage.index + 1);
    });
  });
  describe('getFormattedStages', () => {
    beforeEach(() => {
      stagedProgress = new TestStagedProgress(['Pending', 'Processing', 'Activating', 'Completed', 'Authenticating']);
    });
    it('should get formatted stages - all unknown', () => {
      const formattedStages = stagedProgress.formatStages();
      expect(formattedStages).to.be.ok;
      expect(formattedStages).to.include(StateConstants.unknown.char);
      expect(formattedStages).to.include(chalk.dim(''));
    });
    it('should get formatted stages - pending in progress', () => {
      stagedProgress.updateStages('Pending', State.inProgress);
      const formattedStages = stagedProgress.formatStages();
      expect(formattedStages).to.be.ok;
      expect(formattedStages).to.include(StateConstants.unknown.char);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      expect(formattedStages).to.include(
        StateConstants.inProgress.color(`${StateConstants.inProgress.char} - Pending`)
      );
    });
    it('should get formatted stages - pending successful', () => {
      stagedProgress.updateStages('Pending', State.completed);
      stagedProgress.updateStages('Processing', State.inProgress);
      const formattedStages = stagedProgress.formatStages();
      expect(formattedStages).to.be.ok;
      expect(formattedStages).to.include(StateConstants.unknown.char);
      expect(formattedStages).to.include(StateConstants.completed.color(`${StateConstants.completed.char} - Pending`));
    });
    it('should get formatted stages - processing failed', () => {
      stagedProgress.updateStages('Pending', State.completed);
      stagedProgress.updateStages('Processing', State.failed);
      const formattedStages = stagedProgress.formatStages();
      expect(formattedStages).to.be.ok;
      expect(formattedStages).to.include(StateConstants.unknown.char);
      expect(formattedStages).to.include(StateConstants.failed.color(`${StateConstants.failed.char} - Processing`));
    });
  });
});
