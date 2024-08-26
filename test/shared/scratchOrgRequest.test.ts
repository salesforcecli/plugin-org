/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config, Interfaces } from '@oclif/core';
import { expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { buildScratchOrgRequest } from '../../src/shared/scratchOrgRequest.js';
import EnvCreateScratch from '../../src/commands/org/create/scratch.js';

class Wrapper extends EnvCreateScratch {
  // simple method to return the parsed flags so they can be used in the tests
  public async getFlags(): Promise<Interfaces.InferredFlags<typeof Wrapper.flags>> {
    return (await this.parse(Wrapper)).flags;
  }
}

/** pass in the params in array form, get back the parsed flags */
const paramsToFlags = async (params: string[]): Promise<Interfaces.InferredFlags<typeof EnvCreateScratch.flags>> =>
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
