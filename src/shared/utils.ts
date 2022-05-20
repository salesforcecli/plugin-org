/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildProcess } from 'child_process';
import { GlobalInfo } from '@salesforce/core';
import * as open from 'open';

export const getAliasByUsername = async (username: string): Promise<string> => {
  const globalInfo = await GlobalInfo.create();
  const keys = globalInfo.aliases.getAll(username);
  // use the most recently added alias for that username
  return keys?.length ? keys[keys.length - 1] : undefined;
};

export const openUrl = async (url: string, options: open.Options): Promise<ChildProcess> => {
  return open(url, options);
};
