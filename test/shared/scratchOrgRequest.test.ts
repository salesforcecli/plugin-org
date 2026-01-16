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
import { Config, Interfaces } from '@oclif/core';
import { expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { buildScratchOrgRequest } from '../../src/shared/scratchOrgRequest.js';
import OrgCreateScratch from '../../src/commands/org/create/scratch.js';

class Wrapper extends OrgCreateScratch {
  // simple method to return the parsed flags so they can be used in the tests
  public async getFlags(): Promise<Interfaces.InferredFlags<typeof Wrapper.flags>> {
    return (await this.parse(Wrapper)).flags;
  }
}

/** pass in the params in array form, get back the parsed flags */
const paramsToFlags = async (params: string[]): Promise<Interfaces.InferredFlags<typeof OrgCreateScratch.flags>> =>
  new Wrapper(params, { runHook: () => ({ successes: [], failures: [] }) } as unknown as Config).getFlags();

describe('buildScratchOrgRequest function', () => {
  const $$ = new TestContext();
  beforeEach(async () => {
    const hub = new MockTestOrgData();
    hub.isDevHub = true;
    await $$.stubAuths(hub);
    await $$.stubConfig({ 'target-dev-hub': hub.username });
  });

  after(() => {
    $$.SANDBOX.restore();
  });

  it('edition as only flag', async () => {
    const flags = await paramsToFlags(['--edition', 'developer']);
    const result = await buildScratchOrgRequest(flags);
    expect(result.durationDays).to.equal(7);
    expect(result.orgConfig).to.deep.equal({ edition: 'developer' });
  });

  it('snapshot as only flag', async () => {
    const flags = await paramsToFlags(['--snapshot', 'my-snapshot-name']);
    const result = await buildScratchOrgRequest(flags);
    expect(result.durationDays).to.equal(7);
    expect(result.orgConfig).to.deep.equal({ snapshot: 'my-snapshot-name' });
  });

  describe('source-org', () => {
    it('valid source-org as only flag', async () => {
      const flags = await paramsToFlags(['--source-org', '00D123456789012']);
      const result = await buildScratchOrgRequest(flags);
      expect(result.durationDays).to.equal(7);
      expect(result.orgConfig).to.deep.equal({ sourceOrg: '00D123456789012' });
    });
  });

  describe('definition file', () => {
    it('prop from definitionFile', async () => {
      const flags = await paramsToFlags(['--definition-file', 'test/shared/scratch-def.json']);
      const result = await buildScratchOrgRequest(flags);
      expect(result.durationDays).to.equal(7);
      expect(result.orgConfig?.adminEmail).to.deep.equal('shane@mailinator.com');
    });
    it('prop from definitionFile overridden by flag', async () => {
      const overriddenEmail = 'sarah@mailinator.com';
      const flags = await paramsToFlags([
        '--definition-file',
        'test/shared/scratch-def.json',
        '--admin-email',
        overriddenEmail,
      ]);
      const result = await buildScratchOrgRequest(flags);
      expect(result.durationDays).to.equal(7);
      expect(result.orgConfig?.adminEmail).to.deep.equal(overriddenEmail);
    });
  });

  it('applies secret if given', async () => {
    const secret = 'ImASecret';
    const flags = await paramsToFlags(['--edition', 'developer']);
    const result = await buildScratchOrgRequest(flags, secret);
    expect(result.clientSecret).to.equal(secret);
  });

  it('async becomes 0 min', async () => {
    const flags = await paramsToFlags(['--edition', 'developer', '--async']);
    const result = await buildScratchOrgRequest(flags);
    expect(result.wait?.minutes).to.equal(0);
  });
});
