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
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { Messages, Org, SfError } from '@salesforce/core';
import { stubSfCommandUx, stubPrompter } from '@salesforce/sf-plugins-core';
import OrgAuthShowAccessToken from '../../../../src/commands/org/auth/show-access-token.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'org.auth.show-access-token');

describe('org auth show-access-token', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;
  let prompterStubs: ReturnType<typeof stubPrompter>;

  beforeEach(() => {
    testOrg = new MockTestOrgData();
    testOrg.orgId = '00Dxx0000000000';
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
    prompterStubs = stubPrompter($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('interactive (no --json, no --no-prompt)', () => {
    it('prompts with the correct message including the username', async () => {
      await $$.stubAuths(testOrg);
      prompterStubs.confirm.resolves(true);
      await OrgAuthShowAccessToken.run(['--target-org', testOrg.username]);
      expect(prompterStubs.confirm.callCount).to.equal(1);
      expect(prompterStubs.confirm.firstCall.args[0]).to.deep.equal({
        message: messages.getMessage('prompt.show-access-token', [testOrg.username]),
      });
    });

    it('returns the access token when user confirms', async () => {
      await $$.stubAuths(testOrg);
      prompterStubs.confirm.resolves(true);
      const result = await OrgAuthShowAccessToken.run(['--target-org', testOrg.username]);
      expect(result).to.have.property('accessToken', testOrg.accessToken);
    });

    it('displays the access token in a table when user confirms', async () => {
      await $$.stubAuths(testOrg);
      prompterStubs.confirm.resolves(true);
      await OrgAuthShowAccessToken.run(['--target-org', testOrg.username]);
      const data = sfCommandUxStubs.table.firstCall.args[0].data;
      expect(data).to.deep.include({ key: 'Access Token', value: testOrg.accessToken });
    });

    it('throws when user denies the prompt', async () => {
      await $$.stubAuths(testOrg);
      prompterStubs.confirm.resolves(false);
      try {
        await OrgAuthShowAccessToken.run(['--target-org', testOrg.username]);
        expect.fail('Expected command to throw');
      } catch (e) {
        const err = e as SfError;
        expect(err.message).to.equal('Show access token confirmation denied.');
      }
    });

    it('does not emit the security warning when prompting', async () => {
      await $$.stubAuths(testOrg);
      prompterStubs.confirm.resolves(true);
      await OrgAuthShowAccessToken.run(['--target-org', testOrg.username]);
      const warnCalls = sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args);
      expect(warnCalls).to.not.include(messages.getMessage('warning.show-access-token'));
    });
  });

  describe('--no-prompt', () => {
    it('skips the confirm prompt', async () => {
      await $$.stubAuths(testOrg);
      await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--no-prompt']);
      expect(prompterStubs.confirm.callCount).to.equal(0);
    });

    it('emits the security warning', async () => {
      await $$.stubAuths(testOrg);
      await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--no-prompt']);
      const warnCalls = sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args);
      expect(warnCalls).to.include(messages.getMessage('warning.show-access-token'));
    });

    it('returns the access token', async () => {
      await $$.stubAuths(testOrg);
      const result = await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--no-prompt']);
      expect(result).to.have.property('accessToken', testOrg.accessToken);
    });

    it('displays the access token in a table', async () => {
      await $$.stubAuths(testOrg);
      await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--no-prompt']);
      const data = sfCommandUxStubs.table.firstCall.args[0].data;
      expect(data).to.deep.include({ key: 'Access Token', value: testOrg.accessToken });
    });
  });

  describe('--json', () => {
    it('skips the confirm prompt', async () => {
      await $$.stubAuths(testOrg);
      await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--json']);
      expect(prompterStubs.confirm.callCount).to.equal(0);
    });

    it('emits the security warning', async () => {
      await $$.stubAuths(testOrg);
      await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--json']);
      const warnCalls = sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args);
      expect(warnCalls).to.include(messages.getMessage('warning.show-access-token'));
    });

    it('returns the access token', async () => {
      await $$.stubAuths(testOrg);
      const result = await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--json']);
      expect(result).to.have.property('accessToken', testOrg.accessToken);
    });
  });

  describe('--json --no-prompt', () => {
    it('skips the confirm prompt and emits the security warning', async () => {
      await $$.stubAuths(testOrg);
      const result = await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--json', '--no-prompt']);
      expect(prompterStubs.confirm.callCount).to.equal(0);
      expect(result).to.have.property('accessToken', testOrg.accessToken);
      const warnCalls = sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args);
      expect(warnCalls).to.include(messages.getMessage('warning.show-access-token'));
    });
  });

  describe('error: no access token', () => {
    it('throws the noAccessToken error with the username', async () => {
      // @ts-expect-error testing the case where accessToken is missing
      testOrg.accessToken = undefined;
      await $$.stubAuths(testOrg);
      try {
        await OrgAuthShowAccessToken.run(['--target-org', testOrg.username, '--no-prompt']);
        expect.fail('Expected command to throw');
      } catch (e) {
        const err = e as SfError;
        expect(err.message).to.equal(messages.getMessage('error.noAccessToken', [testOrg.username]));
      }
    });
  });

  describe('auth refresh failure', () => {
    it('warns but continues when auth refresh fails', async () => {
      await $$.stubAuths(testOrg);
      $$.SANDBOX.stub(Org.prototype, 'refreshAuth').rejects(new Error('refresh failed'));
      prompterStubs.confirm.resolves(true);
      const result = await OrgAuthShowAccessToken.run(['--target-org', testOrg.username]);
      expect(result).to.have.property('accessToken', testOrg.accessToken);
      const warnCalls = sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args);
      expect(warnCalls).to.include('Unable to refresh auth for org. Access token may be stale.');
    });
  });
});
