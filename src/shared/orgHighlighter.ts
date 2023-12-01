/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import chalk from 'chalk';
import { ExtendedAuthFields, FullyPopulatedScratchOrgFields } from './orgTypes.js';

const styledProperties = new Map<string, Map<string, chalk.Chalk>>([
  [
    'status',
    new Map([
      ['Active', chalk.green],
      ['else', chalk.red],
    ]),
  ],
  [
    'connectedStatus',
    new Map([
      ['Connected', chalk.green],
      ['Active', chalk.green],
      ['else', chalk.red],
    ]),
  ],
]);

export const getStyledValue = (key: string, value: string): string => {
  if (!value) return value;
  const prop = styledProperties.get(key);
  if (!prop) return value;

  // I'm not sure how to type the inner Map so that it knows else is definitely there
  const chalkMethod = prop.get(value) ?? (prop.get('else') as chalk.Chalk);
  return chalkMethod(value);
};

export const getStyledObject = <T extends ExtendedAuthFields | FullyPopulatedScratchOrgFields>(objectToStyle: T): T =>
  Object.fromEntries(
    Object.entries(objectToStyle).map(([key, value]) => [
      key,
      typeof value === 'string' ? getStyledValue(key, value) : value,
    ])
  ) as T;
