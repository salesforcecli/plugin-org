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
import sinon from 'sinon';
import { StateAggregator } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { getAliasByUsername } from '../../src/shared/utils.js';

describe('getAliasByUsername', () => {
  const sandbox = sinon.createSandbox();
  beforeEach(() => {
    const getAllStub = sandbox.stub();
    getAllStub.withArgs('username1').returns(['alias1']);
    getAllStub.withArgs('username2').returns(['alias2', 'alias2b']);

    stubMethod(sandbox, StateAggregator, 'getInstance').resolves({
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
