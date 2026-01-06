/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'node:fs';
import { Interfaces } from '@oclif/core';
import { ScratchOrgCreateOptions } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import EnvCreateScratch from '../commands/org/create/scratch.js';

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
    ...(flags.snapshot ? { snapshot: flags.snapshot } : {}),
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
