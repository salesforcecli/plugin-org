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
import ansis, { type Ansis } from 'ansis';
import { ExtendedAuthFields, FullyPopulatedScratchOrgFields } from './orgTypes.js';

const styledProperties = new Map<string, Map<string, Ansis>>([
  [
    'status',
    new Map([
      ['Active', ansis.green],
      ['else', ansis.red],
    ]),
  ],
  [
    'connectedStatus',
    new Map([
      ['Connected', ansis.green],
      ['Active', ansis.green],
      ['else', ansis.red],
    ]),
  ],
]);

export const getStyledValue = (key: string, value: string): string => {
  if (!value) return value;
  const prop = styledProperties.get(key);
  if (!prop) return value;

  // I'm not sure how to type the inner Map so that it knows else is definitely there
  const colorMethod = prop.get(value) ?? (prop.get('else') as Ansis);
  return colorMethod(value);
};

export const getStyledObject = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(objectToStyle: T): T =>
  Object.fromEntries(
    Object.entries(objectToStyle).map(([key, value]) => [
      key,
      typeof value === 'string' ? getStyledValue(key, value) : value,
    ])
  ) as T;
