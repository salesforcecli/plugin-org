/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ScratchOrgLifecycleEvent, scratchOrgLifecycleStages, SfError } from '@salesforce/core';
import { Box, Text } from 'ink';
import { capitalCase } from 'change-case';
import React from 'react';
import terminalLink from 'terminal-link';
import { SpinnerOrError, SpinnerOrErrorOrChildren } from './spinner.js';

function round(value: number, decimals = 2): number {
  return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}

function timeInMostReadableFormat(time: number): string {
  // if time < 1000ms, return time in ms
  if (time < 1000) {
    return `${time}ms`;
  }

  // if time < 60s, return time in seconds
  if (time < 60_000) {
    return `${round(time / 1000)}s`;
  }

  // if time < 60m, return time in minutes
  if (time < 3_600_000) {
    return `${round(time / 60_000)}m`;
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

export function Space({ repeat = 1 }: { readonly repeat?: number }): React.ReactNode {
  return <Text>{' '.repeat(repeat)}</Text>;
}

export function Stages(props: {
  readonly currentStage: string;
  readonly stages: string[] | readonly string[];
  readonly title: string;
  readonly error?: SfError | Error | undefined;
}): React.ReactNode {
  const [timings, setTimings] = React.useState<Record<string, { start?: Date; end?: Date }>>(
    Object.fromEntries(props.stages.map((stage) => [stage, {}]))
  );

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

      <Box paddingTop={1}>
        <Text>Elapsed Time: </Text>
        <Timer />
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

  return (
    <Box flexDirection="column">
      <Stages
        title={props.isAsync ? 'Creating Scratch Org (async)' : 'Creating Scratch Org'}
        currentStage={props.data.stage}
        stages={props.isAsync ? ['prepare request', 'send request', 'done'] : scratchOrgLifecycleStages}
        error={props.error}
      />

      <Box flexDirection="column" paddingTop={1}>
        <SpinnerOrErrorOrChildren label="Request Id: " labelPosition="left" error={props.error} type="arc">
          {props.data?.scratchOrgInfo?.Id && (
            <Box>
              <Text bold>{props.data?.scratchOrgInfo?.Id}</Text>
              <Space />
              <Text>({terminalLink('link', `${props.baseUrl}/${props.data?.scratchOrgInfo?.Id}`)})</Text>
            </Box>
          )}
        </SpinnerOrErrorOrChildren>

        <SpinnerOrErrorOrChildren label="OrgId: " labelPosition="left" error={props.error} type="arc">
          {props.data?.scratchOrgInfo?.ScratchOrg && (
            <Text bold color="cyan">
              {props.data?.scratchOrgInfo?.ScratchOrg}
            </Text>
          )}
        </SpinnerOrErrorOrChildren>

        <SpinnerOrErrorOrChildren label="Username: " labelPosition="left" error={props.error} type="arc">
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
