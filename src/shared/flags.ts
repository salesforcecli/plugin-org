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

import { Flags } from '@oclif/core';
import { ConfigAggregator, StateAggregator, Messages, SfError } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete_scratch');

const resolveUsername = async (usernameOrAlias?: string): Promise<string> => {
  const stateAggregator = await StateAggregator.getInstance();
  // we have a value, but don't know if it's a username or an alias
  if (usernameOrAlias) return stateAggregator.aliases.resolveUsername(usernameOrAlias);
  // we didn't get a value, so let's see if the config has a default target org
  const configAggregator = await ConfigAggregator.create();
  const defaultUsernameOrAlias = configAggregator.getPropertyValue('target-org') as string | undefined;
  if (defaultUsernameOrAlias) return stateAggregator.aliases.resolveUsername(defaultUsernameOrAlias);
  throw new SfError(messages.getMessage('error.missingUsername'), 'MissingUsernameError');
};

/**
 * Almost like the use case for the normal optional org flag,
 * but delete commands need to handle the situation where connecting to the org fails because it's expired.
 *
 * Returns the username so you can construct your own org.
 */
export const orgThatMightBeDeleted = Flags.custom({
  char: 'o',
  required: true,
  deprecateAliases: true,
  aliases: ['targetusername', 'u'],
  parse: async (input: string | undefined) => resolveUsername(input),
  default: async () => resolveUsername(),
  defaultHelp: async () => resolveUsername(),
});
