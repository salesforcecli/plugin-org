/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import ansis from 'ansis';
import { ExtendedAuthFields } from '../../src/shared/orgTypes.js';
import { getStyledObject, getStyledValue } from '../../src/shared/orgHighlighter.js';

describe('highlights value from key-value pair', () => {
  it('colors matching property/value green', () => {
    expect(getStyledValue('status', 'Active')).to.equal(ansis.green('Active'));
  });
  it('colors matching property/non-matching value red', () => {
    expect(getStyledValue('status', 'otherVal')).to.equal(ansis.red('otherVal'));
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
      status: ansis.green('Active'),
      otherProp: 'foo',
      connectedStatus: ansis.red('Not found'),
    });
  });
});
