/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as chalk from 'chalk';
import { ExtendedAuthFields } from './orgTypes';

const styledProperties = new Map([
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
      ['else', chalk.red],
    ]),
  ],
]);

export const getStyledValue = (key: string, value: string): string => {
  if (!value || !styledProperties.has(key)) {
    return value;
  }
  return styledProperties.get(key).has(value)
    ? styledProperties.get(key).get(value)(value)
    : styledProperties.get(key).get('else')(value);
};

export const getStyledObject = (objectToStyle: ExtendedAuthFields): Record<string, string> => {
  const clonedObject = { ...objectToStyle };
  return Object.fromEntries(
    Object.entries(clonedObject).map(([key, value]) => [key, getStyledValue(key, value as string)])
  );
};
