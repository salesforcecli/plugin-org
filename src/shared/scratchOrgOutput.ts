/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ScratchOrgLifecycleEvent, scratchOrgLifecycleStages } from '@salesforce/core';
import * as chalk from 'chalk';
import { capitalCase } from 'change-case';
import { StandardColors } from '@salesforce/sf-plugins-core';

const boldBlue = (input: string): string => chalk.rgb(81, 176, 235).bold(input);
const boldPurple = (input: string): string => chalk.rgb(157, 129, 221).bold(input);

export const buildStatus = (data: ScratchOrgLifecycleEvent, baseUrl: string): string => `
RequestId: ${formatRequest(baseUrl, data.scratchOrgInfo?.Id)}
OrgId: ${formatOrgId(data.scratchOrgInfo?.ScratchOrg)}
Username: ${formatUsername(data.scratchOrgInfo?.SignupUsername)}
${formatStage(data.stage)}`;

export const formatStage = (currentStage: ScratchOrgLifecycleEvent['stage']): string =>
  scratchOrgLifecycleStages
    .map((stage, stageIndex) => {
      // current stage
      if (currentStage === stage) return formatCurrentStage(stage);
      // completed stages
      if (scratchOrgLifecycleStages.indexOf(currentStage) > stageIndex) return formatCompletedStage(stage);
      // future stage
      return formatFutureStage(stage);
    })
    .join('\n');

export const formatRequest = (baseUrl: string, id?: string): string =>
  `${id ? `${chalk.bold(id)} (${baseUrl}/${id})` : ''}`;

export const formatUsername = (username: string): string => `${username ? `${boldBlue(username)} ` : ''}`;
export const formatOrgId = (id: string): string => `${id ? `${boldBlue(id)} ` : ''}`;

export const formatCurrentStage = (stage: string): string => boldPurple(capitalCase(stage));
export const formatCompletedStage = (stage: string): string => StandardColors.success.bold(`✓ ${capitalCase(stage)}`);
export const formatFutureStage = (stage: string): string => StandardColors.info(capitalCase(stage));
