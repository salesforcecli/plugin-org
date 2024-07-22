/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { env } from 'node:process';
import { ux } from '@oclif/core/ux';
import { capitalCase } from 'change-case';
import { Box, Instance, render, Text } from 'ink';
import React from 'react';

import { SpinnerOrError, SpinnerOrErrorOrChildren } from './spinner.js';
import { icons, spinners } from './design-elements.js';
import { StageTracker } from './stage-tracker.js';
import { msInMostReadableFormat, secondsInMostReadableFormat } from './utils.js';
import { Divider } from './divider.js';
import { Timer } from './timer.js';

// Taken from https://github.com/sindresorhus/is-in-ci
const isInCi =
  env.CI !== '0' &&
  env.CI !== 'false' &&
  ('CI' in env || 'CONTINUOUS_INTEGRATION' in env || Object.keys(env).some((key) => key.startsWith('CI_')));

type Info<T extends Record<string, unknown>> = {
  /**
   * Color of the value.
   */
  color?: string;
  /**
   * Get the value to display. Takes the data property on the MultiStageComponent as an argument.
   * Useful if you want to apply some logic (like rendering a link) to the data before displaying it.
   *
   * @param data The data property on the MultiStageComponent.
   * @returns {string | undefined}
   */
  get?: (data?: T) => string | undefined;
  /**
   * Whether the value should be bold.
   */
  bold?: boolean;
  /**
   * Whether the value should be a static key-value pair (not a spinner component).
   */
  static?: boolean;
  /**
   * Label to display next to the value.
   */
  label: string;
  /**
   * Stage to display the value on. If not provided, the value will be displayed at the bottom of the stages component.
   */
  stage?: string;
};

type FormattedInfo = {
  readonly color?: string;
  readonly isBold?: boolean;
  readonly isStatic?: boolean;
  readonly label: string;
  readonly value: string | undefined;
  // eslint-disable-next-line react/no-unused-prop-types
  readonly stage?: string;
};

type MultiStageComponentOptions<T extends Record<string, unknown>> = {
  /**
   * Stages to render.
   */
  readonly stages: readonly string[] | string[];
  /**
   * Title to display at the top of the stages component.
   */
  readonly title: string;
  /**
   * Information to display at the bottom of the stages component.
   */
  readonly info?: Array<Info<T>>;
  /**
   * Messages to display at the bottom of the stages component.
   *
   * This will be rendered between the stages and the info section.
   */
  readonly messages?: string[];
  /**
   * Whether to show the total elapsed time. Defaults to true
   */
  readonly showElapsedTime?: boolean;
  /**
   * Whether to show the time spent on each stage. Defaults to true
   */
  readonly showStageTime?: boolean;
  /**
   * The unit to use for the timer. Defaults to 'ms'
   */
  readonly timerUnit?: 'ms' | 's';
  /**
   * Data to display in the stages component. This data will be passed to the get function in the info object.
   */
  readonly data?: Partial<T>;
  /**
   * Whether JSON output is enabled. Defaults to false.
   *
   * Pass in this.jsonEnabled() from the command class to determine if JSON output is enabled.
   */
  readonly jsonEnabled: boolean;
};

type StagesProps = {
  readonly error?: Error | undefined;
  readonly info?: FormattedInfo[];
  readonly messages?: string[];
  readonly title: string;
  readonly hasElapsedTime?: boolean;
  readonly hasStageTime?: boolean;
  readonly timerUnit?: 'ms' | 's';
  readonly stageTracker: StageTracker;
};

function StaticKeyValue({ label, value, isBold, color, isStatic }: FormattedInfo): React.ReactNode {
  if (!value || !isStatic) return;
  return (
    <Box>
      <Text bold={isBold}>{label}: </Text>
      <Text color={color}>{value}</Text>
    </Box>
  );
}

function Infos({ info, error, stage }: { info: FormattedInfo[]; error?: Error; stage?: string }): React.ReactNode {
  return (
    info
      // If stage is provided, only show info for that stage
      // otherwise, show all infos that don't have a specified stage
      .filter((i) => (stage ? i.stage === stage : !i.stage))
      .map((i) =>
        i.isStatic ? (
          <StaticKeyValue key={i.label} {...i} />
        ) : (
          <SpinnerOrErrorOrChildren
            key={i.label}
            label={`${i.label}: `}
            labelPosition="left"
            error={error}
            type={spinners.info}
          >
            {i.value && (
              <Text bold={i.isBold} color={i.color}>
                {i.value}
              </Text>
            )}
          </SpinnerOrErrorOrChildren>
        )
      )
  );
}

function Stages({
  error,
  hasElapsedTime = true,
  hasStageTime = true,
  info,
  messages,
  stageTracker,
  timerUnit = 'ms',
  title,
}: StagesProps): React.ReactNode {
  return (
    <Box flexDirection="column" paddingTop={1}>
      <Divider title={title} />
      {messages && messages.length > 0 && (
        <Box flexDirection="column" paddingTop={1} marginLeft={1}>
          {messages?.map((message) => (
            <Text key={message}>{message}</Text>
          ))}
        </Box>
      )}

      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        {[...stageTracker.entries()].map(([stage, status]) => (
          <Box key={stage} flexDirection="column">
            <Box>
              {(status === 'current' || status === 'failed') && (
                <SpinnerOrError error={error} type={spinners.stage} label={capitalCase(stage)} />
              )}

              {status === 'skipped' && (
                <Text color="dim">
                  {icons.skipped} {capitalCase(stage)} - Skipped
                </Text>
              )}

              {status === 'completed' && (
                <Box>
                  <Text color="green">{icons.completed} </Text>
                  <Text>{capitalCase(stage)} </Text>
                </Box>
              )}

              {status === 'pending' && (
                <Text color="dim">
                  {icons.pending} {capitalCase(stage)}
                </Text>
              )}
              {status !== 'pending' && status !== 'skipped' && hasStageTime && (
                <Box>
                  <Text> </Text>
                  <Timer color="dim" isStopped={status === 'completed'} unit={timerUnit} />
                </Box>
              )}
            </Box>

            {info && status !== 'pending' && status !== 'skipped' && (
              <Box flexDirection="column" marginLeft={5}>
                <Infos info={info} error={error} stage={stage} />
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {info && (
        <Box flexDirection="column" paddingTop={1} marginLeft={1}>
          <Infos info={info} error={error} />
        </Box>
      )}

      {hasElapsedTime && (
        <Box paddingTop={1} marginLeft={1}>
          <Text>Elapsed Time: </Text>
          <Timer unit={timerUnit} />
        </Box>
      )}
    </Box>
  );
}

class CIMultiStageComponent<T extends Record<string, unknown>> {
  private seenStages: Set<string>;
  private data?: Partial<T>;
  private startTime: number | undefined;
  private startTimes: Map<string, number> = new Map();

  private readonly info?: Array<Info<T>>;
  private readonly stages: readonly string[] | string[];
  private readonly title: string;
  private readonly hasElapsedTime?: boolean;
  private readonly hasStageTime?: boolean;
  private readonly timerUnit?: 'ms' | 's';

  public constructor({
    data,
    info,
    showElapsedTime,
    showStageTime,
    stages,
    timerUnit,
    title,
  }: MultiStageComponentOptions<T>) {
    this.title = title;
    this.stages = stages;
    this.seenStages = new Set();
    this.info = info;
    this.hasElapsedTime = showElapsedTime ?? true;
    this.hasStageTime = showStageTime ?? true;
    this.timerUnit = timerUnit ?? 'ms';
    this.data = data;

    ux.stdout(`───── ${this.title} ─────`);
    ux.stdout('Steps:');
    for (const stage of this.stages) {
      ux.stdout(`${this.stages.indexOf(stage) + 1}. ${capitalCase(stage)}`);
    }
    ux.stdout();

    if (this.hasElapsedTime) {
      this.startTime = Date.now();
    }
  }

  public update(stageTracker: StageTracker, data?: Partial<T>): void {
    this.data = { ...this.data, ...data } as T;

    for (const [stage, status] of stageTracker.entries()) {
      // no need to re-render completed, failed, or skipped stages
      if (this.seenStages.has(stage)) continue;

      switch (status) {
        case 'pending':
          // do nothing
          break;
        case 'current':
          this.startTimes.set(stage, Date.now());
          break;
        case 'failed':
        case 'skipped':
        case 'completed':
          this.seenStages.add(stage);
          if (this.hasStageTime && status !== 'skipped') {
            const startTime = this.startTimes.get(stage);
            const elapsedTime = startTime ? Date.now() - startTime : 0;
            const displayTime =
              this.timerUnit === 'ms'
                ? msInMostReadableFormat(elapsedTime)
                : secondsInMostReadableFormat(elapsedTime, 0);
            ux.stdout(`${icons[status]} ${capitalCase(stage)} (${displayTime})`);
          } else if (status === 'skipped') {
            ux.stdout(`${icons[status]} ${capitalCase(stage)} - Skipped`);
          } else {
            ux.stdout(`${icons[status]} ${capitalCase(stage)}`);
          }

          break;
        default:
        // do nothing
      }
    }

    this.printInfo();
  }

  // eslint-disable-next-line class-methods-use-this
  public addMessage(message: string): void {
    ux.stdout(message);
  }

  public stop(stageTracker: StageTracker): void {
    this.update(stageTracker);
    if (this.startTime) {
      const elapsedTime = Date.now() - this.startTime;
      ux.stdout();
      const displayTime =
        this.timerUnit === 'ms' ? msInMostReadableFormat(elapsedTime) : secondsInMostReadableFormat(elapsedTime, 0);
      ux.stdout(`Elapsed time: ${displayTime}`);
    }

    this.printInfo();
  }

  private printInfo(): void {
    if (!this.info) return;
    ux.stdout();
    for (const info of this.info) {
      const formattedData = info.get ? info.get(this.data as T) : undefined;
      if (formattedData) {
        ux.stdout(`${info.label}: ${formattedData}`);
      }
    }
  }
}

export class MultiStageComponent<T extends Record<string, unknown>> implements Disposable {
  private data?: Partial<T>;
  private inkInstance: Instance | undefined;
  private ciInstance: CIMultiStageComponent<T> | undefined;
  private stageTracker: StageTracker;
  private stopped = false;
  private messages: string[];

  private readonly info?: Array<Info<T>>;
  private readonly stages: readonly string[] | string[];
  private readonly title: string;
  private readonly hasElapsedTime?: boolean;
  private readonly hasStageTime?: boolean;
  private readonly timerUnit?: 'ms' | 's';

  public constructor({
    data,
    info,
    jsonEnabled,
    messages,
    showElapsedTime,
    showStageTime,
    stages,
    timerUnit,
    title,
  }: MultiStageComponentOptions<T>) {
    this.data = data;
    this.stages = stages;
    this.title = title;
    this.info = info;
    this.hasElapsedTime = showElapsedTime ?? true;
    this.hasStageTime = showStageTime ?? true;
    this.timerUnit = timerUnit ?? 'ms';
    this.stageTracker = new StageTracker(stages);
    this.messages = messages ?? [];

    if (!jsonEnabled) {
      if (isInCi) {
        this.ciInstance = new CIMultiStageComponent({
          stages,
          title,
          info,
          showElapsedTime,
          showStageTime,
          timerUnit,
          data,
          jsonEnabled,
        });
      } else {
        this.inkInstance = render(
          <Stages
            hasElapsedTime={this.hasElapsedTime}
            hasStageTime={this.hasStageTime}
            info={this.formatInfo()}
            messages={this.messages}
            stageTracker={this.stageTracker}
            timerUnit={this.timerUnit}
            title={this.title}
          />
        );
      }
    }
  }

  public addMessage(message: string): void {
    if (this.stopped) return;
    this.messages.push(message);
    if (isInCi) {
      this.ciInstance?.addMessage(message);
    } else {
      this.inkInstance?.rerender(
        <Stages
          hasElapsedTime={this.hasElapsedTime}
          hasStageTime={this.hasStageTime}
          info={this.formatInfo()}
          messages={this.messages}
          stageTracker={this.stageTracker}
          timerUnit={this.timerUnit}
          title={this.title}
        />
      );
    }
  }

  public next(data?: Partial<T>): void {
    if (this.stopped) return;

    const nextStageIndex = this.stages.indexOf(this.stageTracker.current ?? this.stages[0]) + 1;
    if (nextStageIndex < this.stages.length) {
      this.update(this.stages[nextStageIndex], data);
    }
  }

  public goto(stage: string, data?: Partial<T>): void {
    if (this.stopped) return;

    // ignore non-existent stages
    if (!this.stages.includes(stage)) return;

    // prevent going to a previous stage
    if (this.stages.indexOf(stage) < this.stages.indexOf(this.stageTracker.current ?? this.stages[0])) return;

    this.update(stage, data);
  }

  public updateData(data: Partial<T>): void {
    if (this.stopped) return;
    this.data = { ...this.data, ...data } as T;

    this.update(this.stageTracker.current ?? this.stages[0], data);
  }

  public stop(error?: Error): void {
    if (this.stopped) return;
    this.stopped = true;

    this.stageTracker.refresh(this.stageTracker.current ?? this.stages[0], { hasError: !!error, isStopping: true });

    if (isInCi) {
      this.ciInstance?.stop(this.stageTracker);
      return;
    }

    if (error) {
      this.inkInstance?.rerender(
        <Stages
          error={error}
          hasElapsedTime={this.hasElapsedTime}
          hasStageTime={this.hasStageTime}
          info={this.formatInfo()}
          messages={this.messages}
          stageTracker={this.stageTracker}
          timerUnit={this.timerUnit}
          title={this.title}
        />
      );
    } else {
      this.inkInstance?.rerender(
        <Stages
          hasElapsedTime={this.hasElapsedTime}
          hasStageTime={this.hasStageTime}
          info={this.formatInfo()}
          messages={this.messages}
          stageTracker={this.stageTracker}
          timerUnit={this.timerUnit}
          title={this.title}
        />
      );
    }

    this.inkInstance?.unmount();
  }

  public [Symbol.dispose](): void {
    this.inkInstance?.unmount();
  }

  private update(stage: string, data?: Partial<T>): void {
    this.data = { ...this.data, ...data } as Partial<T>;

    this.stageTracker.refresh(stage);

    if (isInCi) {
      this.ciInstance?.update(this.stageTracker, this.data);
    } else {
      this.inkInstance?.rerender(
        <Stages
          hasElapsedTime={this.hasElapsedTime}
          hasStageTime={this.hasStageTime}
          info={this.formatInfo()}
          messages={this.messages}
          stageTracker={this.stageTracker}
          timerUnit={this.timerUnit}
          title={this.title}
        />
      );
    }
  }

  private formatInfo(): FormattedInfo[] {
    return (
      this.info?.map((info) => {
        const formattedData = info.get ? info.get(this.data as T) : undefined;
        return {
          value: formattedData,
          label: info.label,
          isBold: info.bold,
          color: info.color,
          isStatic: info.static,
          stage: info.stage,
        };
      }) ?? []
    );
  }
}
