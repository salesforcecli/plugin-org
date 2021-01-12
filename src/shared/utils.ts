/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases } from '@salesforce/core';

export const getAliasByUsername = async (username: string): Promise<string> => {
  const alias = await Aliases.create(Aliases.getDefaultOptions());
  const aliasContent = alias.getContents().orgs;
  if (aliasContent) {
    for (const aliasedName of Object.keys(aliasContent)) {
      if (aliasContent[aliasedName] === username) return aliasedName;
    }
  }
  return undefined;
};

export const camelCaseToTitleCase = (text: string): string => {
  return text
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())
    .replace(/([A-Z][a-z]+)/g, ' $1')
    .trim();
};
