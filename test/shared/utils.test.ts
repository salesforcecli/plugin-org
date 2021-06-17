/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect } from '@salesforce/command/lib/test';
import { Aliases } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { createOpenOptions, getAliasByUsername } from '../../src/shared/utils';

const duffBrowser = 'duff';

describe('getAliasByUsername', () => {
  beforeEach(async () => {
    stubMethod($$.SANDBOX, Aliases, 'create').resolves(Aliases.prototype);
    stubMethod($$.SANDBOX, Aliases, 'getDefaultOptions').returns({});
    stubMethod($$.SANDBOX, Aliases.prototype, 'getKeysByValue')
      .withArgs('username1')
      .returns(['alias1'])
      .withArgs('username2')
      .returns(['alias2', 'alias2b']);
  });
  afterEach(() => {
    $$.SANDBOX.restore();
  });

  it('returns alias for a username that exists', async () => {
    expect(await getAliasByUsername('username1')).to.equal('alias1');
  });

  it('returns first alias for a username that has multiple aliases', async () => {
    expect(await getAliasByUsername('username2')).to.equal('alias2');
  });

  it('returns undefined when no matching username is found', async () => {
    expect(await getAliasByUsername('username3')).to.be.undefined;
  });
});

describe('createOpenOptions', () => {
  it('returns options for known browser string', async () => {
    expect(createOpenOptions('FIREFOX')).to.not.eql(null);
  });
  it('returns null options for unknown browser string', async () => {
    expect(createOpenOptions(duffBrowser)).to.eql(null);
  });
});
