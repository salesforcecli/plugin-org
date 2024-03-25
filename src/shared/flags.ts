/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags } from '@oclif/core';
import { ConfigAggregator, StateAggregator, Messages, SfError } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

const resolveUsername = async (usernameOrAlias?: string): Promise<string> => {
  const stateAggregator = await StateAggregator.getInstance();
  // we have a value, but don't know if it's a username or an alias
  if (usernameOrAlias) return stateAggregator.aliases.resolveUsername(usernameOrAlias);
  // we didn't get a value, so let's see if the config has a default target org
  const configAggregator = await ConfigAggregator.create();
  const defaultUsernameOrAlias = configAggregator.getPropertyValue('target-org') as string | undefined;
  if (defaultUsernameOrAlias) return stateAggregator.aliases.resolveUsername(defaultUsernameOrAlias);
  throw new SfError(messages.getMessage('missingUsername'), 'MissingUsernameError');
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
