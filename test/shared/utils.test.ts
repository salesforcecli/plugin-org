/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@salesforce/command/lib/test';
import * as sinon from 'sinon';
import { GlobalInfo } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { getAliasByUsername } from '../../src/shared/utils';

describe('getAliasByUsername', () => {
  const sandbox = sinon.createSandbox();
  beforeEach(async () => {
    const getAllStub = sandbox.stub();
    getAllStub.withArgs('username1').returns(['alias1']);
    getAllStub.withArgs('username2').returns(['alias2', 'alias2b']);

    stubMethod(sandbox, GlobalInfo, 'getInstance').resolves({
      aliases: {
        getAll: getAllStub,
      },
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('returns alias for a username that exists', async () => {
    expect(await getAliasByUsername('username1')).to.equal('alias1');
  });

  it('returns most recent alias for a username that has multiple aliases', async () => {
    expect(await getAliasByUsername('username2')).to.equal('alias2b');
  });

  it('returns undefined when no matching username is found', async () => {
    expect(await getAliasByUsername('username3')).to.be.undefined;
  });
});
