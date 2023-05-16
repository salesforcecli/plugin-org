/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { Interfaces } from '@oclif/core';
import { ScratchOrgCreateOptions } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import EnvCreateScratch from '../commands/org/create/scratch';
/**
 * Provide the parsed flags
 * Returns the objet necessary to create a scratch org
 */
export const buildScratchOrgRequest = async (
  flags: Interfaces.InferredFlags<typeof EnvCreateScratch.flags>,
  clientSecret?: string
): Promise<ScratchOrgCreateOptions> => {
  const orgConfig = {
    ...(flags['definition-file']
      ? (JSON.parse(await fs.promises.readFile(flags['definition-file'], 'utf-8')) as Record<string, unknown>)
      : {}),
    ...(flags.edition ? { edition: flags.edition } : {}),
    ...(flags.username ? { username: flags.username } : {}),
    ...(flags.description ? { description: flags.description } : {}),
    ...(flags.name ? { orgName: flags.name } : {}),
    ...(flags.release ? { release: flags.release } : {}),
    ...(flags['source-org'] ? { sourceOrg: flags['source-org'] } : {}),
    ...(flags['admin-email'] ? { adminEmail: flags['admin-email'] } : {}),
  };

  const createCommandOptions: ScratchOrgCreateOptions = {
    hubOrg: flags['target-dev-hub'],
    clientSecret,
    connectedAppConsumerKey: flags['client-id'],
    durationDays: flags['duration-days'].days,
    nonamespace: flags['no-namespace'],
    noancestors: flags['no-ancestors'],
    wait: flags.async ? Duration.minutes(0) : flags.wait,
    apiversion: flags['api-version'],
    orgConfig,
    alias: flags.alias,
    setDefault: flags['set-default'],
    tracksSource: flags['track-source'],
  };

  return createCommandOptions;
};
