/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
