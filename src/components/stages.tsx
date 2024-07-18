/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Performance } from '@oclif/core';
import { SfError } from '@salesforce/core';
import { Box, Instance, render, Text } from 'ink';
import { capitalCase } from 'change-case';
import React from 'react';

import { SpinnerOrError, SpinnerOrErrorOrChildren } from './spinner.js';

type Info<T extends Record<string, unknown>> = {
  /**
   * Color of the value.
   */
  color?: string;
  /**
   * Get the value to display. Takes the data property on the MultiStageRenderer as an argument.
   * Useful if you want to apply some logic (like rendering a link) to the data before displaying it.
   *
   * @param data The data property on the MultiStageRenderer.
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

type MultiStageRendererOptions<T extends Record<string, unknown>> = {
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
};

type StagesProps = {
  readonly currentStage?: string;
  readonly error?: SfError | Error | undefined;
  readonly hasFinished?: boolean;
  readonly info?: FormattedInfo[];
  readonly stages: string[] | readonly string[];
  readonly title: string;
  readonly hasElapsedTime?: boolean;
  readonly hasStageTime?: boolean;
  readonly timerUnit?: 'ms' | 's';
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

const MARKERS = new Map<string, ReturnType<typeof Performance.mark>>();

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
  currentStage,
  error,
  hasElapsedTime = true,
  hasFinished,
  hasStageTime = true,
  info,
  stages,
  timerUnit = 'ms',
  title,
}: StagesProps): React.ReactNode {
  if (!currentStage) return;

  const spinnerType = process.platform === 'win32' ? 'line' : 'arc';
  return (
    <Box flexDirection="column" paddingTop={1}>
      <Divider title={title} />
      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        {stages.map((stage, stageIndex) => {
          const isCurrent = currentStage === stage && !hasFinished;
          const isCompleted = hasFinished ?? (!isCurrent && stages.indexOf(currentStage) >= stageIndex);
          const isFuture = !isCompleted && !isCurrent && stages.indexOf(currentStage) < stageIndex;

          if (isCurrent && !MARKERS.has(stage)) {
            MARKERS.set(stage, Performance.mark('MultiStageRenderer', stage.replaceAll(' ', '-').toLowerCase()));
          }

          if (isCompleted) {
            const marker = MARKERS.get(stage);
            if (marker && !marker.stopped) {
              marker.stop();
            }
          }

          return (
            <Box key={stage}>
              {isCurrent && <SpinnerOrError error={error} type="dots2" label={capitalCase(stage)} />}

              {isCompleted && (
                <Box>
                  <Text color="green">✓ </Text>
                  <Text>{capitalCase(stage)} </Text>
                </Box>
              )}

              {isFuture && <Text color="dim">◼ {capitalCase(stage)}</Text>}
              {!isFuture && hasStageTime && (
                <Box>
                  <Space />
                  <Timer color="dim" isStopped={isCompleted} unit={timerUnit} />
                </Box>
              )}
            </Box>
          );
        })}
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

export class MultiStageRenderer<T extends Record<string, unknown>> implements Disposable {
  private currentStage: string;
  private data?: T;
  private instance: Instance | undefined;

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
    timerUnit: timerUnit,
  }: MultiStageRendererOptions<T>) {
    this.stages = stages;
    this.title = title;
    this.info = info;
    this.currentStage = stages[0];
    this.hasElapsedTime = showElapsedTime ?? true;
    this.hasStageTime = showStageTime ?? true;
    this.timerUnit = timerUnit ?? 'ms';
  }

  public start(data?: Partial<T>): void {
    this.data = { ...this.data, ...data } as T;
    this.instance = render(
      <Stages
        hasElapsedTime={this.hasElapsedTime}
        hasStageTime={this.hasStageTime}
        timerUnit={this.timerUnit}
        info={this.formatInfo()}
        stages={this.stages}
        title={this.title}
      />
    );
  }

  public next(data?: Partial<T>): void {
    const nextStageIndex = this.stages.indexOf(this.currentStage) + 1;
    if (nextStageIndex < this.stages.length) {
      this.update(this.stages[nextStageIndex], data);
    }
  }

  public previous(data?: Partial<T>): void {
    const previousStageIndex = this.stages.indexOf(this.currentStage) - 1;
    if (previousStageIndex >= 0) {
      this.update(this.stages[previousStageIndex], data);
    }
  }

  public goto(stage: string, data?: Partial<T>): void {
    if (this.stages.includes(stage)) {
      this.update(stage, data);
    }
  }

  public last(data?: Partial<T>): void {
    this.update(this.stages[this.stages.length - 1], data);
  }

  public stop(error?: Error | SfError): void {
    if (error) {
      this.instance?.rerender(
        <Stages
          currentStage={this.currentStage}
          info={this.formatInfo()}
          stages={this.stages}
          title={this.title}
          error={error}
          hasElapsedTime={this.hasElapsedTime}
          hasStageTime={this.hasStageTime}
          timerUnit={this.timerUnit}
        />
      );
    } else {
      this.instance?.rerender(
        <Stages
          hasFinished
          currentStage={this.currentStage}
          info={this.formatInfo()}
          stages={this.stages}
          title={this.title}
          hasElapsedTime={this.hasElapsedTime}
          hasStageTime={this.hasStageTime}
          timerUnit={this.timerUnit}
        />
      );
    }

    this.instance?.unmount();
  }

  public [Symbol.dispose](): void {
    this.instance?.unmount();
  }

  private update(stage: string, data?: Partial<T>): void {
    this.currentStage = stage;
    this.data = { ...this.data, ...data } as T;
    this.instance?.rerender(
      <Stages
        hasElapsedTime={this.hasElapsedTime}
        hasStageTime={this.hasStageTime}
        timerUnit={this.timerUnit}
        info={this.formatInfo()}
        currentStage={this.currentStage}
        stages={this.stages}
        title={this.title}
      />
    );
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
