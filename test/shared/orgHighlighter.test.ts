/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as chalk from 'chalk';
import { ExtendedAuthFields } from '../../src/shared/orgTypes';
import { getStyledObject, getStyledValue } from '../../src/shared/orgHighlighter';

describe('highlights value from key-value pair', () => {
  it('colors matching property/value green', () => {
    expect(getStyledValue('status', 'Active')).to.equal(chalk.green('Active'));
  });
  it('colors matching property/non-matching value red', () => {
    expect(getStyledValue('status', 'otherVal')).to.equal(chalk.red('otherVal'));
  });
  it('ignores a non matched property', () => {
    expect(getStyledValue('otherProp', 'otherVal')).to.equal('otherVal');
  });
});

describe('highlights object with green, red, and non-colored', () => {
  it('green for matching property, matching value', () => {
    const object = {
      status: 'Active',
      otherProp: 'foo',
      connectedStatus: 'Not found',
      // I know it's not, but it's a test
    } as unknown as ExtendedAuthFields;
    expect(getStyledObject(object)).to.deep.equal({
      status: chalk.green('Active'),
      otherProp: 'foo',
      connectedStatus: chalk.red('Not found'),
    });
  });
});
