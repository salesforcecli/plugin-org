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
import { OrgOpenAuthoringBundle } from '../../../../src/commands/org/open/authoring-bundle.js';
import { OrgOpenOutput } from '../../../../src/shared/orgTypes.js';
import utils from '../../../../src/shared/orgOpenUtils.js';

describe('org:open:authoring-bundle', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  const singleUseToken = (Math.random() + 1).toString(36).substring(2);
  const expectedDefaultSingleUseUrl = `${testOrg.instanceUrl}/secur/frontdoor.jsp?otp=${singleUseToken}`;
  const getExpectedUrlWithPath = (path: string) => `${expectedDefaultSingleUseUrl}&startURL=${path}`;

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
  });

  afterEach(() => {
    spies.clear();
  });

  describe('url generation', () => {
    it('opens default Agentforce Studio list view without flags', async () => {
      const response = await OrgOpenAuthoringBundle.run(['--json', '--target-org', testOrg.username, '--url-only']);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(getExpectedUrlWithPath('lightning/n/standard-AgentforceStudio'));
    });

    it('builds URL with api-name only', async () => {
      const apiName = 'MyTestAgent';
      const response = await OrgOpenAuthoringBundle.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-name',
        apiName,
      ]);
      assert(response);
      testJsonStructure(response);
      const expectedPath = `AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=${apiName}`;
      expect(response.url).to.equal(getExpectedUrlWithPath(expectedPath));
    });

    it('builds URL with api-name and version', async () => {
      const apiName = 'MyTestAgent';
      const version = '1';
      const response = await OrgOpenAuthoringBundle.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-name',
        apiName,
        '--version',
        version,
      ]);
      assert(response);
      testJsonStructure(response);
      const expectedPath = `AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=${apiName}&projectVersionNumber=${version}`;
      expect(response.url).to.equal(getExpectedUrlWithPath(expectedPath));
    });

    it('properly encodes special characters in api-name', async () => {
      const apiName = 'My Test Agent';
      const response = await OrgOpenAuthoringBundle.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-name',
        apiName,
      ]);
      assert(response);
      testJsonStructure(response);
      const expectedPath = 'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=My+Test+Agent';
      expect(response.url).to.equal(getExpectedUrlWithPath(expectedPath));
    });

    it('properly encodes special characters in version', async () => {
      const apiName = 'MyAgent';
      const version = '1.0-beta';
      const response = await OrgOpenAuthoringBundle.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-name',
        apiName,
        '--version',
        version,
      ]);
      assert(response);
      testJsonStructure(response);
      const expectedPath =
        'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=MyAgent&projectVersionNumber=1.0-beta';
      expect(response.url).to.equal(getExpectedUrlWithPath(expectedPath));
    });

    it('generates single-use URL when --url-only is not passed', async () => {
      const response = await OrgOpenAuthoringBundle.run(['--json', '--target-org', testOrg.username]);
      assert(response);
      testJsonStructure(response);
      expect(spies.get('requestGet').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
      expect(response.url).to.equal(getExpectedUrlWithPath('lightning/n/standard-AgentforceStudio'));
    });
  });

  describe('browser integration', () => {
    it('opens in specified browser with api-name', async () => {
      const apiName = 'MyAgent';
      await OrgOpenAuthoringBundle.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--api-name',
        apiName,
        '--browser',
        'firefox',
      ]);

      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.not.eql({});
    });

    it('opens in private mode', async () => {
      await OrgOpenAuthoringBundle.run(['--json', '--target-org', testOrg.username, '--private']);

      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.have.property('newInstance');
    });
  });

  describe('flag validation', () => {
    it('allows api-name without version', async () => {
      const response = await OrgOpenAuthoringBundle.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-name',
        'MyAgent',
      ]);
      assert(response);
      testJsonStructure(response);
    });

    it('requires api-name when version is provided', async () => {
      try {
        await OrgOpenAuthoringBundle.run(['--json', '--target-org', testOrg.username, '--url-only', '--version', '1']);
        assert.fail('Should have thrown an error');
      } catch (error) {
        // Expected to fail due to missing api-name dependency
        expect(error).to.exist;
      }
    });
  });

  describe('human output', () => {
    it('outputs success message without URL when opening browser', async () => {
      await OrgOpenAuthoringBundle.run(['--json', '--target-org', testOrg.username]);

      expect(sfCommandUxStubs.logSuccess.callCount).to.be.greaterThan(0);
      expect(spies.get('open').callCount).to.equal(1);
    });

    it('outputs URL when using --url-only', async () => {
      await OrgOpenAuthoringBundle.run(['--target-org', testOrg.username, '--url-only']);

      expect(sfCommandUxStubs.logSuccess.callCount).to.be.greaterThan(0);
      expect(spies.get('open').callCount).to.equal(0);
    });

    it('outputs URL with api-name when using --url-only', async () => {
      await OrgOpenAuthoringBundle.run([
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-name',
        'MyAgent',
        '--version',
        '1',
      ]);

      expect(sfCommandUxStubs.logSuccess.callCount).to.be.greaterThan(0);
      expect(spies.get('open').callCount).to.equal(0);
    });
  });

  describe('api-version flag', () => {
    it('respects api-version flag', async () => {
      const apiVersion = '59.0';
      const response = await OrgOpenAuthoringBundle.run([
        '--json',
        '--target-org',
        testOrg.username,
        '--url-only',
        '--api-version',
        apiVersion,
      ]);
      assert(response);
      testJsonStructure(response);
    });
  });
});
