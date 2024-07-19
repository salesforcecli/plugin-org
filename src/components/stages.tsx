/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { env } from 'node:process';
import { Performance, ux } from '@oclif/core';
import { Box, Instance, render, Text } from 'ink';
import { capitalCase } from 'change-case';
import React from 'react';

import { SpinnerOrError, SpinnerOrErrorOrChildren } from './spinner.js';

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
  get?: (data: T) => string | undefined;
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
};

type FormattedInfo = {
  readonly color?: string;
  readonly isBold?: boolean;
  readonly isStatic?: boolean;
  readonly label: string;
  readonly value: string | undefined;
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

type StageStatus = 'pending' | 'current' | 'completed' | 'skipped' | 'failed';

class StageTracker extends Map<string, StageStatus> {
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

type StagesProps = {
  readonly error?: Error | undefined;
  readonly info?: FormattedInfo[];
  readonly title: string;
  readonly hasElapsedTime?: boolean;
  readonly hasStageTime?: boolean;
  readonly timerUnit?: 'ms' | 's';
  readonly stageTracker: StageTracker;
};

function round(value: number, decimals = 2): string {
  const factor = Math.pow(10, decimals);
  return (Math.round(value * factor) / factor).toFixed(decimals);
}

function msInMostReadableFormat(time: number, decimals = 2): string {
  // if time < 1000ms, return time in ms
  if (time < 1000) {
    return `${time}ms`;
  }

  return secondsInMostReadableFormat(time, decimals);
}

function secondsInMostReadableFormat(time: number, decimals = 2): string {
  if (time < 1000) {
    return '< 1s';
  }

  // if time < 60s, return time in seconds
  if (time < 60_000) {
    return `${round(time / 1000, decimals)}s`;
  }

  // if time < 60m, return time in minutes and seconds
  if (time < 3_600_000) {
    const minutes = Math.floor(time / 60_000);
    const seconds = round((time % 60_000) / 1000, 0);
    return `${minutes}m ${seconds}s`;
  }

  return time.toString();
}

const getSideDividerWidth = (width: number, titleWidth: number): number => (width - titleWidth) / 2;
const getNumberOfCharsPerWidth = (char: string, width: number): number => width / char.length;

const PAD = ' ';

function Divider({
  title = '',
  width = 50,
  padding = 1,
  titlePadding = 1,
  titleColor = 'white',
  dividerChar = '─',
  dividerColor = 'dim',
}: {
  readonly title?: string;
  readonly width?: number | 'full';
  readonly padding?: number;
  readonly titleColor?: string;
  readonly titlePadding?: number;
  readonly dividerChar?: string;
  readonly dividerColor?: string;
}): React.ReactNode {
  const titleString = title ? `${PAD.repeat(titlePadding) + title + PAD.repeat(titlePadding)}` : '';
  const titleWidth = titleString.length;
  const terminalWidth = process.stdout.columns ?? 80;
  const widthToUse = width === 'full' ? terminalWidth - titlePadding : width > terminalWidth ? terminalWidth : width;

  const dividerWidth = getSideDividerWidth(widthToUse, titleWidth);
  const numberOfCharsPerSide = getNumberOfCharsPerWidth(dividerChar, dividerWidth);
  const dividerSideString = dividerChar.repeat(numberOfCharsPerSide);

  const paddingString = PAD.repeat(padding);

  return (
    <Box flexDirection="row">
      <Text>
        {paddingString}
        <Text color={dividerColor}>{dividerSideString}</Text>
        <Text color={titleColor}>{titleString}</Text>
        <Text color={dividerColor}>{dividerSideString}</Text>
        {paddingString}
      </Text>
    </Box>
  );
}

function Timer({
  color,
  isStopped,
  unit,
}: {
  readonly color?: string;
  readonly isStopped?: boolean;
  readonly unit: 'ms' | 's';
}): React.ReactNode {
  const [time, setTime] = React.useState(0);
  const [previousDate, setPreviousDate] = React.useState(Date.now());

  React.useEffect(() => {
    if (isStopped) {
      setTime(time + (Date.now() - previousDate));
      setPreviousDate(Date.now());
      return () => {};
    }

    const intervalId = setInterval(
      () => {
        setTime(time + (Date.now() - previousDate));
        setPreviousDate(Date.now());
      },
      unit === 'ms' ? 1 : 1000
    );

    return (): void => {
      clearInterval(intervalId);
    };
  }, [time, isStopped, previousDate, unit]);

  return (
    <Text color={color}>{unit === 'ms' ? msInMostReadableFormat(time) : secondsInMostReadableFormat(time, 0)}</Text>
  );
}

function Space({ repeat = 1 }: { readonly repeat?: number }): React.ReactNode {
  return <Text>{' '.repeat(repeat)}</Text>;
}

function StaticKeyValue({ label, value, isBold, color, isStatic }: FormattedInfo): React.ReactNode {
  if (!value || !isStatic) return;
  return (
    <Box>
      <Text bold={isBold}>{label}: </Text>
      <Text color={color}>{value}</Text>
    </Box>
  );
}

function Stages({
  error,
  hasElapsedTime = true,
  hasStageTime = true,
  info,
  stageTracker,
  timerUnit = 'ms',
  title,
}: StagesProps): React.ReactNode {
  const spinnerType = process.platform === 'win32' ? 'line' : 'arc';

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Divider title={title} />
      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        {[...stageTracker.entries()].map(([stage, status]) => (
          <Box key={stage}>
            {(status === 'current' || status === 'failed') && (
              <SpinnerOrError error={error} type="dots2" label={capitalCase(stage)} />
            )}

            {status === 'skipped' && <Text color="dim">◯ {capitalCase(stage)} - Skipped</Text>}

            {status === 'completed' && (
              <Box>
                <Text color="green">✓ </Text>
                <Text>{capitalCase(stage)} </Text>
              </Box>
            )}

            {status === 'pending' && <Text color="dim">◼ {capitalCase(stage)}</Text>}
            {status !== 'pending' && status !== 'skipped' && hasStageTime && (
              <Box>
                <Space />
                <Timer color="dim" isStopped={status === 'completed'} unit={timerUnit} />
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {hasElapsedTime && (
        <Box paddingTop={1} marginLeft={1}>
          <Text>Elapsed Time: </Text>
          <Timer unit={timerUnit} />
        </Box>
      )}

      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        {info?.map((i) =>
          i.isStatic ? (
            <StaticKeyValue key={i.label} {...i} />
          ) : (
            <SpinnerOrErrorOrChildren
              key={i.label}
              label={`${i.label}: `}
              labelPosition="left"
              error={error}
              type={spinnerType}
            >
              {i.value && (
                <Text bold={i.isBold} color={i.color}>
                  {i.value}
                </Text>
              )}
            </SpinnerOrErrorOrChildren>
          )
        )}
      </Box>
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

      const icon = status === 'failed' ? '✖' : status === 'completed' ? '✔' : status === 'skipped' ? '◯' : '◼';

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
            ux.stdout(`${icon} ${capitalCase(stage)} (${displayTime})`);
          } else if (status === 'skipped') {
            ux.stdout(`${icon} ${capitalCase(stage)} - Skipped`);
          } else {
            ux.stdout(`${icon} ${capitalCase(stage)}`);
          }

          break;
        default:
        // do nothing
      }
    }
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

    ux.stdout();
    for (const info of this.info ?? []) {
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

  private readonly info?: Array<Info<T>>;
  private readonly stages: readonly string[] | string[];
  private readonly title: string;
  private readonly hasElapsedTime?: boolean;
  private readonly hasStageTime?: boolean;
  private readonly timerUnit?: 'ms' | 's';

  public constructor({
    info,
    stages,
    title,
    showElapsedTime,
    showStageTime,
    timerUnit,
    jsonEnabled,
    data,
  }: MultiStageComponentOptions<T>) {
    this.data = data;
    this.stages = stages;
    this.title = title;
    this.info = info;
    this.hasElapsedTime = showElapsedTime ?? true;
    this.hasStageTime = showStageTime ?? true;
    this.timerUnit = timerUnit ?? 'ms';
    this.stageTracker = new StageTracker(stages);

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
            stageTracker={this.stageTracker}
            timerUnit={this.timerUnit}
            title={this.title}
          />
        );
      }
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
        };
      }) ?? []
    );
  }
}
