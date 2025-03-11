/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { upperFirst } from '@salesforce/kit';
import { StateAggregator } from '@salesforce/core';

export const getAliasByUsername = async (username: string): Promise<string | undefined> => {
  const stateAggregator = await StateAggregator.getInstance();
  // eslint-disable-next-line no-console
  console.log(stateAggregator);
  const keys = stateAggregator.aliases.getAll(username);
  // use the most recently added alias for that username
  return keys?.length ? keys[keys.length - 1] : undefined;
};

export const lowerToUpper = (object: Record<string, unknown>): Record<string, unknown> =>
  // the API has keys defined in capital camel case, while the definition schema has them as lower camel case
  // we need to convert lower camel case to upper before merging options so they will override properly
  Object.fromEntries(Object.entries(object).map(([key, value]) => [upperFirst(key), value]));

export default {
  getAliasByUsername,
  lowerToUpper,
};

export const isDefined = <T>(value: T | undefined | null): value is T => value !== undefined && value !== null;
