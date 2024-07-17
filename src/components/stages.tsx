/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { format } from 'node:util';
import { ScratchOrgLifecycleEvent, scratchOrgLifecycleStages, SfError } from '@salesforce/core';
import { Box, Instance, render, Text } from 'ink';
import { capitalCase } from 'change-case';
import React from 'react';
import terminalLink from 'terminal-link';
import { Duration } from '@salesforce/kit';
import { SpinnerOrError, SpinnerOrErrorOrChildren } from './spinner.js';

function round(value: number, decimals = 2): string {
  const factor = Math.pow(10, decimals);
  return (Math.round(value * factor) / factor).toFixed(decimals);
}

function timeInMostReadableFormat(time: number, decimals = 2): string {
  // if time < 1000ms, return time in ms
  if (time < 1000) {
    return `${time}ms`;
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

function diff(start: Date | undefined, end: Date | undefined): string {
  if (!start || !end) {
    return '0ms';
  }

  return timeInMostReadableFormat(end.getTime() - start.getTime());
}

const getSideDividerWidth = (width: number, titleWidth: number): number => (width - titleWidth) / 2;
const getNumberOfCharsPerWidth = (char: string, width: number): number => width / char.length;

const PAD = ' ';

export function Divider({
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
  // width ??= process.stdout.columns ? process.stdout.columns - titlePadding : 80;
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

export function Timer(props: { readonly color?: string }): React.ReactNode {
  const [time, setTime] = React.useState(0);

  const interval = 10;

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      setTime((prevTime) => prevTime + interval);
    }, interval);

    return (): void => {
      clearInterval(intervalId);
    };
  }, [interval]);

  return <Text {...props}>{timeInMostReadableFormat(time)}</Text>;
}

export function Countdown(props: {
  readonly text: string;
  readonly time: Duration;
  readonly color?: string;
}): React.ReactNode {
  const [time, setTime] = React.useState(props.time.milliseconds);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      setTime((prevTime) => prevTime - 1000);
    }, 1000);

    return (): void => {
      clearInterval(intervalId);
    };
  }, []);

  if (time <= 0) {
    return;
  }

  const formatted = format(props.text, timeInMostReadableFormat(time, 0));
  return <Text {...props}>{formatted}</Text>;
}

export function Space({ repeat = 1 }: { readonly repeat?: number }): React.ReactNode {
  return <Text>{' '.repeat(repeat)}</Text>;
}

// How to integrate with telemetry?
export function Stages(props: {
  readonly info?: FormattedInfo[];
  readonly currentStage: string;
  readonly stages: string[] | readonly string[];
  readonly title: string;
  readonly error?: SfError | Error | undefined;
  readonly timeout?: Duration | undefined;
}): React.ReactNode {
  const [timings, setTimings] = React.useState<Record<string, { start?: Date; end?: Date }>>(
    Object.fromEntries(props.stages.map((stage) => [stage, {}]))
  );

  const spinnerType = process.platform === 'win32' ? 'line' : 'arc';

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Divider title={props.title} />
      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        {props.stages.map((stage, stageIndex) => {
          // current stage
          if (props.currentStage === stage && stageIndex < props.stages.length - 1) {
            if (!timings[stage].start) {
              timings[stage].start = new Date();
              setTimings({ ...timings });
            }

            return (
              <Box key={stage}>
                <SpinnerOrError error={props.error} type="dots2" label={capitalCase(stage)} />
                <Space />
                <Timer color="dim" />
              </Box>
            );
          }

          // completed stages
          if (props.stages.indexOf(props.currentStage) >= stageIndex) {
            if (!timings[stage].end) {
              timings[stage].end = new Date();
              setTimings({ ...timings });
            }

            return (
              <Box key={stage}>
                <Text color="green">✓ </Text>
                <Text>{capitalCase(stage)} </Text>
                <Text color="dim">{diff(timings[stage].start, timings[stage].end)}</Text>
              </Box>
            );
          }

          // future stage
          return (
            <Text key={stage} color="dim">
              ◼ {capitalCase(stage)}
            </Text>
          );
        })}
      </Box>

      {/* TODO: figure out why stage time is longer than elapsed time */}
      {/* TODO: figure out if countdown timer is actually worth having if it's not perfectly synced with the polling */}
      {/* timeout could be specific to certain stages... so maybe it needs to be rendered on the stage? */}
      <Box paddingTop={1} marginLeft={1}>
        <Text>Elapsed Time: </Text>
        <Timer />
        {props.timeout && (
          <Box>
            <Space />
            <Countdown text="(timeout in %s)" time={props.timeout} />
          </Box>
        )}
      </Box>

      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        {props.info?.map((info) => (
          <SpinnerOrErrorOrChildren
            key={info.label}
            label={`${info.label}: `}
            labelPosition="left"
            error={props.error}
            type={spinnerType}
          >
            {info.value && (
              <Text bold={info.bold} color={info.color}>
                {info.value}
              </Text>
            )}
          </SpinnerOrErrorOrChildren>
        ))}
      </Box>
    </Box>
  );
}

export function Status(props: {
  readonly data?: ScratchOrgLifecycleEvent;
  readonly baseUrl: string;
  readonly isAsync?: boolean;
  readonly error?: SfError | Error | undefined;
}): React.ReactNode {
  if (!props.data) return;
  const spinnerType = process.platform === 'win32' ? 'line' : 'arc';
  return (
    <Box flexDirection="column">
      <Stages
        title={props.isAsync ? 'Creating Scratch Org (async)' : 'Creating Scratch Org'}
        currentStage={props.data.stage}
        stages={props.isAsync ? ['prepare request', 'send request', 'done'] : scratchOrgLifecycleStages}
        error={props.error}
      />

      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        <SpinnerOrErrorOrChildren label="Request Id: " labelPosition="left" error={props.error} type={spinnerType}>
          {props.data?.scratchOrgInfo?.Id && (
            <Text bold>
              {terminalLink(props.data?.scratchOrgInfo?.Id, `${props.baseUrl}/${props.data?.scratchOrgInfo?.Id}`)}
            </Text>
          )}
        </SpinnerOrErrorOrChildren>

        <SpinnerOrErrorOrChildren label="OrgId: " labelPosition="left" error={props.error} type={spinnerType}>
          {props.data?.scratchOrgInfo?.ScratchOrg && (
            <Text bold color="cyan">
              {props.data?.scratchOrgInfo?.ScratchOrg}
            </Text>
          )}
        </SpinnerOrErrorOrChildren>

        <SpinnerOrErrorOrChildren label="Username: " labelPosition="left" error={props.error} type={spinnerType}>
          {props.data?.scratchOrgInfo?.SignupUsername && (
            <Text bold color="cyan">
              {props.data?.scratchOrgInfo?.SignupUsername}
            </Text>
          )}
        </SpinnerOrErrorOrChildren>
      </Box>
    </Box>
  );
}

type Info<T extends Record<string, unknown>> = {
  label: string;
  get?: (data: T) => string | undefined;
  bold?: boolean;
  color?: string;
};

type FormattedInfo = {
  label: string;
  value: string | undefined;
  bold?: boolean;
  color?: string;
};

type MultiStageRendererOptions<T extends Record<string, unknown>> = {
  readonly stages: readonly string[] | string[];
  readonly title: string;
  readonly info?: Array<Info<T>>;
  readonly timeout?: Duration;
};

export class MultiStageRenderer<T extends Record<string, unknown>> {
  private currentStage: string;
  private data?: T;
  private readonly info?: Array<Info<T>>;
  private readonly stages: readonly string[] | string[];
  private readonly title: string;
  private readonly timeout?: Duration | undefined;
  private instance: Instance | undefined;

  public constructor({ info, stages, title, timeout }: MultiStageRendererOptions<T>) {
    this.stages = stages;
    this.title = title;
    this.info = info;
    this.timeout = timeout;
    this.currentStage = stages[0];
  }

  public start(data?: Partial<T>): void {
    this.data = { ...this.data, ...data } as T;

    this.instance = render(
      <Stages
        timeout={this.timeout}
        info={this.formatInfo()}
        currentStage={this.stages[0]}
        stages={this.stages}
        title={this.title}
      />,
      { debug: false }
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
          timeout={this.timeout}
          info={this.formatInfo()}
          currentStage={this.currentStage ?? this.stages[0]}
          stages={this.stages}
          title={this.title}
          error={error}
        />
      );
    }

    this.instance?.unmount();
  }

  private update(stage: string, data?: Partial<T>): void {
    this.currentStage = stage;
    this.data = { ...this.data, ...data } as T;
    this.instance?.rerender(
      <Stages
        timeout={this.timeout}
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
        // @ts-expect-error for now
        const formattedData = info.get ? info.get(this.data) : undefined;
        return { value: formattedData, label: info.label, bold: info.bold, color: info.color };
      }) ?? []
    );
  }
}
