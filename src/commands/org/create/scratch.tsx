/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Lifecycle,
  Messages,
  Org,
  scratchOrgCreate,
  ScratchOrgLifecycleEvent,
  scratchOrgLifecycleEventName,
  scratchOrgLifecycleStages,
  SfError,
} from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { Box, Instance, Text, render } from 'ink';
import { capitalCase } from 'change-case';
import React from 'react';
import terminalLink from 'terminal-link';
import { SpinnerOrError, SpinnerOrErrorOrChildren } from '../../../components/spinner.js';
import { buildScratchOrgRequest } from '../../../shared/scratchOrgRequest.js';
import { ScratchCreateResponse } from '../../../shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create_scratch');

const definitionFileHelpGroupName = 'Definition File Override';

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

function Timer(props: { readonly color?: string }): React.ReactNode {
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

function Space({ repeat = 1 }: { readonly repeat?: number }): React.ReactNode {
  return <Text>{' '.repeat(repeat)}</Text>;
}

function Stages(props: {
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

function Status(props: {
  readonly data?: ScratchOrgLifecycleEvent;
  readonly baseUrl: string;
  readonly error?: SfError | Error | undefined;
}): React.ReactNode {
  if (!props.data) return;

  return (
    <Box flexDirection="column">
      <Stages
        title="Creating Scratch Org"
        currentStage={props.data.stage}
        stages={scratchOrgLifecycleStages}
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

export default class OrgCreateScratch extends SfCommand<ScratchCreateResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['env:create:scratch'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    alias: Flags.string({
      char: 'a',
      summary: messages.getMessage('flags.alias.summary'),
      description: messages.getMessage('flags.alias.description'),
    }),
    async: Flags.boolean({
      summary: messages.getMessage('flags.async.summary'),
      description: messages.getMessage('flags.async.description'),
    }),
    'set-default': Flags.boolean({
      char: 'd',
      summary: messages.getMessage('flags.set-default.summary'),
    }),
    'definition-file': Flags.file({
      exists: true,
      char: 'f',
      summary: messages.getMessage('flags.definition-file.summary'),
      description: messages.getMessage('flags.definition-file.description'),
    }),
    'target-dev-hub': Flags.requiredHub({
      char: 'v',
      summary: messages.getMessage('flags.target-dev-hub.summary'),
      description: messages.getMessage('flags.target-dev-hub.description'),
      required: true,
    }),
    'no-ancestors': Flags.boolean({
      char: 'c',
      summary: messages.getMessage('flags.no-ancestors.summary'),
      helpGroup: 'Packaging',
    }),
    edition: Flags.string({
      char: 'e',
      summary: messages.getMessage('flags.edition.summary'),
      description: messages.getMessage('flags.edition.description'),
      options: [
        'developer',
        'enterprise',
        'group',
        'professional',
        'partner-developer',
        'partner-enterprise',
        'partner-group',
        'partner-professional',
      ],
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (value: string) => {
        // the API expects partner editions in `partner <EDITION>` format.
        // so we replace the hyphen here with a space.
        if (value.startsWith('partner-')) {
          return value.replace('-', ' ');
        }
        return value;
      },
      helpGroup: definitionFileHelpGroupName,
    }),
    'no-namespace': Flags.boolean({
      char: 'm',
      summary: messages.getMessage('flags.no-namespace.summary'),
      helpGroup: 'Packaging',
    }),
    'duration-days': Flags.duration({
      unit: 'days',
      default: Duration.days(7),
      min: 1,
      max: 30,
      char: 'y',
      helpValue: '<days>',
      summary: messages.getMessage('flags.duration-days.summary'),
    }),
    wait: Flags.duration({
      unit: 'minutes',
      default: Duration.minutes(5),
      min: 1,
      char: 'w',
      helpValue: '<minutes>',
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
    }),
    'api-version': Flags.orgApiVersion(),
    'client-id': Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.client-id.summary'),
    }),
    'track-source': Flags.boolean({
      default: true,
      char: 't',
      summary: messages.getMessage('flags.track-source.summary'),
      description: messages.getMessage('flags.track-source.description'),
      allowNo: true,
    }),
    username: Flags.string({
      summary: messages.getMessage('flags.username.summary'),
      description: messages.getMessage('flags.username.description'),
      helpGroup: definitionFileHelpGroupName,
    }),
    description: Flags.string({
      summary: messages.getMessage('flags.description.summary'),
      helpGroup: definitionFileHelpGroupName,
    }),
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      helpGroup: definitionFileHelpGroupName,
    }),
    release: Flags.string({
      summary: messages.getMessage('flags.release.summary'),
      description: messages.getMessage('flags.release.description'),
      options: ['preview', 'previous'],
      helpGroup: definitionFileHelpGroupName,
    }),
    'admin-email': Flags.string({
      summary: messages.getMessage('flags.admin-email.summary'),
      helpGroup: definitionFileHelpGroupName,
    }),
    'source-org': Flags.salesforceId({
      summary: messages.getMessage('flags.source-org.summary'),
      startsWith: '00D',
      length: 15,
      helpGroup: definitionFileHelpGroupName,
      // salesforceId flag has `i` and that would be a conflict with client-id
      char: undefined,
    }),
  };

  public async run(): Promise<ScratchCreateResponse> {
    const lifecycle = Lifecycle.getInstance();
    const { flags } = await this.parse(OrgCreateScratch);
    const baseUrl = flags['target-dev-hub'].getField(Org.Fields.INSTANCE_URL)?.toString();
    if (!baseUrl) {
      throw new SfError('No instance URL found for the dev hub');
    }

    const createCommandOptions = await buildScratchOrgRequest(
      flags,
      flags['client-id'] ? await this.secretPrompt({ message: messages.getMessage('prompt.secret') }) : undefined
    );

    let asyncInstance: Instance | undefined;
    let statusInstance: Instance | undefined;
    let scratchOrgLifecycleData: ScratchOrgLifecycleEvent | undefined;

    if (flags.async) {
      asyncInstance = render(
        <SpinnerOrError type="dots2" label=" Requesting Scratch Org (will not wait for completion because --async)" />
      );
    } else {
      // TODO: should this be abstracted?
      statusInstance = render(<Status baseUrl={baseUrl} />);
      lifecycle.on<ScratchOrgLifecycleEvent>(scratchOrgLifecycleEventName, async (data): Promise<void> => {
        scratchOrgLifecycleData = data;
        statusInstance?.rerender(<Status data={data} baseUrl={baseUrl} />);
        if (data.stage === 'done') {
          statusInstance?.unmount();
        }
        return Promise.resolve();
      });
    }

    try {
      const { username, scratchOrgInfo, authFields, warnings } = await scratchOrgCreate(createCommandOptions);

      if (!scratchOrgInfo) {
        throw new SfError('The scratch org did not return with any information');
      }
      this.log();
      if (flags.async) {
        asyncInstance?.clear();
        asyncInstance?.unmount();
        this.info(messages.getMessage('action.resume', [this.config.bin, scratchOrgInfo.Id]));
      } else {
        this.logSuccess(messages.getMessage('success'));
      }

      return { username, scratchOrgInfo, authFields, warnings, orgId: authFields?.orgId };
    } catch (error) {
      if (asyncInstance) {
        // TODO: show success in the spinner
        asyncInstance.unmount();
      }

      if (statusInstance) {
        statusInstance.rerender(<Status data={scratchOrgLifecycleData} error={error as Error} baseUrl={baseUrl} />);
        statusInstance.unmount();
      }

      if (error instanceof SfError && error.name === 'ScratchOrgInfoTimeoutError') {
        const scratchOrgInfoId = (error.data as { scratchOrgInfoId: string }).scratchOrgInfoId;
        const resumeMessage = messages.getMessage('action.resume', [this.config.bin, scratchOrgInfoId]);

        this.log();
        this.info(resumeMessage);
        this.error('The scratch org did not complete within your wait time', { code: '69', exit: 69 });
      } else {
        throw error;
      }
    }
  }
}
