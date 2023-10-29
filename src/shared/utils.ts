/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildProcess } from 'node:child_process';
import { upperFirst } from '@salesforce/kit';
import { StateAggregator } from '@salesforce/core';
import * as open from 'open';

export const getAliasByUsername = async (username: string): Promise<string | undefined> => {
  const stateAggregator = await StateAggregator.getInstance();
  const keys = stateAggregator.aliases.getAll(username);
  // use the most recently added alias for that username
  return keys?.length ? keys[keys.length - 1] : undefined;
};

export const openUrl = async (url: string, options: open.Options): Promise<ChildProcess> => open(url, options);

export const lowerToUpper = (object: Record<string, unknown>): Record<string, unknown> =>
  // the API has keys defined in capital camel case, while the definition schema has them as lower camel case
  // we need to convert lower camel case to upper before merging options so they will override properly
  Object.fromEntries(Object.entries(object).map(([key, value]) => [upperFirst(key), value]));
