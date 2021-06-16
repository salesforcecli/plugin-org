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
  // use the most recently added alias for that username
  return keys?.length ? keys[keys.length - 1] : undefined;
};

export const createOpenOptions = (browser: string): open.Options => {
  switch (browser.toLowerCase()) {
    case 'chrome':
    case 'edge':
    case 'firefox':
      return { app: { name: open.apps[browser.toLowerCase()] as open.AppName } };
    default:
      // Support this so as not to break if 'open' adds more support.
      return { app: { name: browser } };
  }
};

export const openUrl = async (url: string, options: open.Options): Promise<ChildProcess> => {
  return open(url, options);
};
