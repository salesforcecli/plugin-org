/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildProcess } from 'child_process';
import { Aliases } from '@salesforce/core';
import * as open from 'open';

export const getAliasByUsername = async (username: string): Promise<string> => {
  const alias = await Aliases.create(Aliases.getDefaultOptions());
  const keys = alias.getKeysByValue(username);
  return keys?.length ? keys[0] : undefined;
};

export const camelCaseToTitleCase = (text: string): string => {
  return text
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())
    .replace(/([A-Z][a-z]+)/g, ' $1')
    .trim();
};

export const openUrl = async (url: string): Promise<ChildProcess> => {
  return open(url);
};
