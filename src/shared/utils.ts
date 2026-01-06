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
import { upperFirst } from '@salesforce/kit';
import { StateAggregator } from '@salesforce/core';

export const getAliasByUsername = async (username: string): Promise<string | undefined> => {
  const stateAggregator = await StateAggregator.getInstance();
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
