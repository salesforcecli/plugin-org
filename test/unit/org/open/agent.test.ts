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
import { EventEmitter } from 'node:events';
import { assert, expect } from 'chai';
import { Connection, SfdcUrl } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx, stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import { OrgOpenAgent } from '../../../../src/commands/org/open/agent.js';
import { OrgOpenOutput } from '../../../../src/shared/orgTypes.js';
import utils from '../../../../src/shared/orgOpenUtils.js';

describe('org:open:agent', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  const singleUseToken = (Math.random() + 1).toString(36).substring(2);
  const expectedDefaultSingleUseUrl = `${testOrg.instanceUrl}/secur/frontdoor.jsp?otp=${singleUseToken}`;
  const getExpectedUrlWithPath = (path: string) => `${expectedDefaultSingleUseUrl}&startURL=${path}`;

  const mockBotId = '0Xx1234567890ABCD';
  const mockBotName = 'TestAgent';
  const mockVersionId = '0X9DD0000000032s0AA';

  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  const testJsonStructure = (response: OrgOpenOutput) => {
    expect(response).to.have.property('url');
    expect(response).to.have.property('username').equal(testOrg.username);
    expect(response).to.have.property('orgId').equal(testOrg.orgId);
  };

  const spies = new Map();

  beforeEach(async () => {
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
    stubUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    await $$.stubAuths(testOrg);
    spies.set('open', stubMethod($$.SANDBOX, utils, 'openUrl').resolves(new EventEmitter()));
    spies.set(
      'requestGet',
      stubMethod($$.SANDBOX, Connection.prototype, 'requestGet').callsFake((url: string) => {
        const urlObj = new URL(url);
        const redirectUri = urlObj.searchParams.get('redirect_uri');
        return Promise.resolve({
          // eslint-disable-next-line camelcase
          frontdoor_uri: redirectUri
            ? `${expectedDefaultSingleUseUrl}&startURL=${redirectUri}`
            : expectedDefaultSingleUseUrl,
        });
      })
    );
    spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));
    spies.set(
      'singleRecordQuery',
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves({ Id: mockBotId })
    );
  });

  afterEach(() => {
    spies.clear();
  });

  describe('flag validation', () => {
    it('requires either api-name or authoring-bundle', async () => {
      try {
        await OrgOpenAgent.run(['--json', '--target-org', testOrg.username, '--url-only']);
        assert.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect((error as Error).message).to.include('Exactly one of the following must be provided');
        expect((error as Error).message).to.include('--api-name');
        expect((error as Error).message).to.include('--authoring-bundle');
      }
    });

    it('does not allow both api-name and authoring-bundle', async () => {
      try {
        await OrgOpenAgent.run([
          '--json',
          '--target-org',
          testOrg.username,
          '--url-only',
          '--api-name',
          mockBotName,
          '--authoring-bundle',
          'MyAgent',
        ]);
        assert.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect((error as Error).message).to.include('--api-name');
        expect((error as Error).message).to.include('--authoring-bundle');
        expect((error as Error).message).to.match(/exactly one|cannot also be provided/i);
      }
    });
  });

  describe('url generation with api-name', () => {
    it('builds URL with api-name using BotDefinition query', async () => {
      const response = await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-name',
        mockBotName,
      ]);
      assert(response);
      testJsonStructure(response);

      // Verify the BotDefinition query was made
      expect(spies.get('singleRecordQuery').callCount).to.equal(1);
      expect(spies.get('singleRecordQuery').firstCall.args[0]).to.include(mockBotName);
      expect(spies.get('singleRecordQuery').firstCall.args[0]).to.include('BotDefinition');

      const expectedPath = `AiCopilot/copilotStudio.app#/copilot/builder?copilotId=${mockBotId}`;
      expect(response.url).to.equal(getExpectedUrlWithPath(expectedPath));
    });

    it('generates single-use URL when --url-only is not passed', async () => {
      const response = await OrgOpenAgent.run(['--json', '--target-org', testOrg.username, '--api-name', mockBotName]);
      assert(response);
      testJsonStructure(response);
      expect(spies.get('requestGet').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('singleRecordQuery').callCount).to.equal(1);
    });

    it('properly queries BotDefinition with special characters in api-name', async () => {
      const specialName = 'Test_Agent_01';
      await OrgOpenAgent.run(['--json', '--target-org', testOrg.username, '--url-only', '--api-name', specialName]);

      expect(spies.get('singleRecordQuery').callCount).to.equal(1);
      expect(spies.get('singleRecordQuery').firstCall.args[0]).to.include(specialName);
    });

    it('builds URL with api-name and version using BotVersion query', async () => {
      const version = '2';
      // Override the singleRecordQuery stub to return different results for BotDefinition and BotVersion
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const singleRecordQueryStub = spies.get('singleRecordQuery');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      singleRecordQueryStub.onFirstCall().resolves({ Id: mockBotId }); // BotDefinition query
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      singleRecordQueryStub.onSecondCall().resolves({ Id: mockVersionId }); // BotVersion query

      const response = await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-name',
        mockBotName,
        '--version',
        version,
      ]);
      assert(response);
      testJsonStructure(response);

      // Verify both queries were made
      expect(singleRecordQueryStub.callCount).to.equal(2);

      // Verify BotDefinition query
      expect(singleRecordQueryStub.firstCall.args[0]).to.include(mockBotName);
      expect(singleRecordQueryStub.firstCall.args[0]).to.include('BotDefinition');

      // Verify BotVersion query
      expect(singleRecordQueryStub.secondCall.args[0]).to.include('BotVersion');
      expect(singleRecordQueryStub.secondCall.args[0]).to.include(mockBotId);
      expect(singleRecordQueryStub.secondCall.args[0]).to.include(`VersionNumber=${version}`);

      const expectedPath = `AiCopilot/copilotStudio.app#/copilot/builder?copilotId=${mockBotId}&versionId=${mockVersionId}`;
      expect(response.url).to.equal(getExpectedUrlWithPath(expectedPath));
    });
  });

  describe('url generation with authoring-bundle', () => {
    it('builds URL with authoring-bundle only', async () => {
      const bundleName = 'MyTestAgent';
      const response = await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--authoring-bundle',
        bundleName,
      ]);
      assert(response);
      testJsonStructure(response);

      // Verify no BotDefinition query was made
      expect(spies.get('singleRecordQuery').callCount).to.equal(0);

      const expectedPath = `AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=${bundleName}`;
      expect(response.url).to.equal(getExpectedUrlWithPath(expectedPath));
    });

    it('builds URL with authoring-bundle and version', async () => {
      const bundleName = 'MyTestAgent';
      const version = '13';
      const response = await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--authoring-bundle',
        bundleName,
        '--version',
        version,
      ]);
      assert(response);
      testJsonStructure(response);

      const expectedPath = `AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=${bundleName}&projectVersionNumber=${version}`;
      expect(response.url).to.equal(getExpectedUrlWithPath(expectedPath));
    });

    it('generates single-use URL when --url-only is not passed', async () => {
      const response = await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--authoring-bundle',
        'MyAgent',
      ]);
      assert(response);
      testJsonStructure(response);
      expect(spies.get('requestGet').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('singleRecordQuery').callCount).to.equal(0);
    });
  });

  describe('browser integration', () => {
    it('opens in specified browser with api-name', async () => {
      await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--api-name',
        mockBotName,
        '--browser',
        'firefox',
      ]);

      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.not.eql({});
    });

    it('opens in specified browser with authoring-bundle', async () => {
      await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--authoring-bundle',
        'MyAgent',
        '--browser',
        'firefox',
      ]);

      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.not.eql({});
    });

    it('opens in private mode with api-name', async () => {
      await OrgOpenAgent.run(['--json', '--target-org', testOrg.username, '--api-name', mockBotName, '--private']);

      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.have.property('newInstance');
    });

    it('opens in private mode with authoring-bundle', async () => {
      await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--authoring-bundle',
        'MyAgent',
        '--private',
      ]);

      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.have.property('newInstance');
    });
  });

  describe('human output', () => {
    it('outputs success message without URL when opening browser with api-name', async () => {
      await OrgOpenAgent.run(['--json', '--target-org', testOrg.username, '--api-name', mockBotName]);

      expect(sfCommandUxStubs.logSuccess.callCount).to.be.greaterThan(0);
      expect(spies.get('open').callCount).to.equal(1);
    });

    it('outputs success message without URL when opening browser with authoring-bundle', async () => {
      await OrgOpenAgent.run(['--json', '--target-org', testOrg.username, '--authoring-bundle', 'MyAgent']);

      expect(sfCommandUxStubs.logSuccess.callCount).to.be.greaterThan(0);
      expect(spies.get('open').callCount).to.equal(1);
    });

    it('outputs URL when using --url-only with api-name', async () => {
      await OrgOpenAgent.run(['--target-org', testOrg.username, '--url-only', '--api-name', mockBotName]);

      expect(sfCommandUxStubs.logSuccess.callCount).to.be.greaterThan(0);
      expect(spies.get('open').callCount).to.equal(0);
    });

    it('outputs URL when using --url-only with authoring-bundle', async () => {
      await OrgOpenAgent.run([
        '--target-org',
        testOrg.username,
        '--url-only',
        '--authoring-bundle',
        'MyAgent',
        '--version',
        '1',
      ]);

      expect(sfCommandUxStubs.logSuccess.callCount).to.be.greaterThan(0);
      expect(spies.get('open').callCount).to.equal(0);
    });
  });

  describe('api-version flag', () => {
    it('respects api-version flag with api-name', async () => {
      const apiVersion = '59.0';
      const response = await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-version',
        apiVersion,
        '--api-name',
        mockBotName,
      ]);
      assert(response);
      testJsonStructure(response);
    });

    it('respects api-version flag with authoring-bundle', async () => {
      const apiVersion = '59.0';
      const response = await OrgOpenAgent.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-version',
        apiVersion,
        '--authoring-bundle',
        'MyAgent',
      ]);
      assert(response);
      testJsonStructure(response);
    });
  });
});
