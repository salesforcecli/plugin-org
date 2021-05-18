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

interface openArgs {
  app?: {
    name: string;
  };
}

export const openUrl = async (url: string, args: openArgs): Promise<ChildProcess> => {
  return open(url, args);
};
