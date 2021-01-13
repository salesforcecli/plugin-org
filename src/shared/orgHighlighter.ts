/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import chalk from 'chalk';

const styledProperties = {
  status: {
    Active: 'green',
    else: 'red',
  },
  connectedStatus: {
    Connected: 'green',
    else: 'red',
  },
};

export const getStyledValue = (key, value): string => {
  if (styledProperties[key] && value) {
    return styledProperties[key][value]
      ? chalk[styledProperties[key][value]](value)
      : chalk[styledProperties[key].else](value);
  }
  return value;
};

export const getStyledObject = (objectToStyle: object): object => {
  for (const key of Object.keys(styledProperties)) {
    if (Reflect.has(objectToStyle, key)) {
      objectToStyle[key] = getStyledValue(key, objectToStyle[key]);
    }
  }
  return objectToStyle;
};
