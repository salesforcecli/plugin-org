/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ScratchOrgLifecycleEvent, scratchOrgLifecycleStages, SfError } from '@salesforce/core';
import { Box, Instance, render, Text } from 'ink';
import { capitalCase } from 'change-case';
import React from 'react';
import terminalLink from 'terminal-link';
import { Duration } from '@salesforce/kit';
import { Performance } from '@oclif/core';
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

export function Timer(props: { readonly color?: string; readonly isStopped?: boolean }): React.ReactNode {
  const [time, setTime] = React.useState(0);

  const interval = 10;

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      if (!props.isStopped) {
        setTime((prevTime) => prevTime + interval);
      }
    }, interval);

    return (): void => {
      clearInterval(intervalId);
    };
  }, [interval, props.isStopped]);

  if (props.isStopped) {
    return <Text {...props}>{timeInMostReadableFormat(time)}</Text>;
  }

  return <Text {...props}>{timeInMostReadableFormat(time)}</Text>;
}

export function Space({ repeat = 1 }: { readonly repeat?: number }): React.ReactNode {
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

// How to integrate with telemetry?
export function Stages(props: {
  readonly info?: FormattedInfo[];
  readonly currentStage: string;
  readonly stages: string[] | readonly string[];
  readonly title: string;
  readonly error?: SfError | Error | undefined;
  readonly timeout?: Duration | undefined;
}): React.ReactNode {
  const markers = new Map<string, ReturnType<typeof Performance.mark>>();

  const spinnerType = process.platform === 'win32' ? 'line' : 'arc';

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Divider title={props.title} />
      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        {props.stages.map((stage, stageIndex) => {
          const isCurrent = props.currentStage === stage && stageIndex < props.stages.length - 1;
          const isCompleted = !isCurrent && props.stages.indexOf(props.currentStage) >= stageIndex;
          const isFuture = !isCompleted && !isCurrent && props.stages.indexOf(props.currentStage) < stageIndex;

          if (isCurrent) {
            markers.set(stage, Performance.mark('plugin-org', stage));
          }
          if (isCompleted) {
            markers.get(stage)?.stop();
          }

          return (
            <Box key={stage}>
              {isCurrent && <SpinnerOrError error={props.error} type="dots2" label={capitalCase(stage)} />}

              {isCompleted && (
                <Box>
                  <Text color="green">✓ </Text>
                  <Text>{capitalCase(stage)} </Text>
                </Box>
              )}

              {isFuture && <Text color="dim">◼ {capitalCase(stage)}</Text>}
              {!isFuture && (
                <Box>
                  <Space />
                  <Timer color="dim" isStopped={isCompleted} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box paddingTop={1} marginLeft={1}>
        <Text>Elapsed Time: </Text>
        <Timer />
      </Box>

      <Box flexDirection="column" paddingTop={1} marginLeft={1}>
        {props.info?.map((info) =>
          info.isStatic ? (
            <StaticKeyValue key={info.label} {...info} />
          ) : (
            <SpinnerOrErrorOrChildren
              key={info.label}
              label={`${info.label}: `}
              labelPosition="left"
              error={props.error}
              type={spinnerType}
            >
              {info.value && (
                <Text bold={info.isBold} color={info.color}>
                  {info.value}
                </Text>
              )}
            </SpinnerOrErrorOrChildren>
          )
        )}
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
  color?: string;
  get?: (data: T) => string | undefined;
  isBold?: boolean;
  isStatic?: boolean;
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
  readonly stages: readonly string[] | string[];
  readonly title: string;
  readonly info?: Array<Info<T>>;
};

export class MultiStageRenderer<T extends Record<string, unknown>> implements Disposable {
  private currentStage: string;
  private data?: T;
  private readonly info?: Array<Info<T>>;
  private readonly stages: readonly string[] | string[];
  private readonly title: string;
  private instance: Instance | undefined;

  public constructor({ info, stages, title }: MultiStageRendererOptions<T>) {
    this.stages = stages;
    this.title = title;
    this.info = info;
    this.currentStage = stages[0];
  }

  public start(data?: Partial<T>): void {
    this.data = { ...this.data, ...data } as T;

    this.instance = render(
      <Stages info={this.formatInfo()} currentStage={this.stages[0]} stages={this.stages} title={this.title} />,
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

  public [Symbol.dispose](): void {
    this.instance?.unmount();
  }

  private update(stage: string, data?: Partial<T>): void {
    this.currentStage = stage;
    this.data = { ...this.data, ...data } as T;
    this.instance?.rerender(
      <Stages info={this.formatInfo()} currentStage={this.currentStage} stages={this.stages} title={this.title} />
    );
  }

  private formatInfo(): FormattedInfo[] {
    return (
      this.info?.map((info) => {
        const formattedData = info.get ? info.get(this.data as T) : undefined;
        return {
          value: formattedData,
          label: info.label,
          isBold: info.isBold,
          color: info.color,
          isStatic: info.isStatic,
        };
      }) ?? []
    );
  }
}
