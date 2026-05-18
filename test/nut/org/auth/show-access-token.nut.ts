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
import { join } from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { assert, expect } from 'chai';
import { accessTokenRegex } from '@salesforce/core';
import { OrgAuthShowAccessTokenResult } from '../../../../src/commands/org/auth/show-access-token.js';

describe('org auth show-access-token NUTs', () => {
  let session: TestSession;
  let scratchUsername: string;

  before(async () => {
    session = await TestSession.create({
      project: { name: 'showAccessToken' },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          config: join('config', 'project-scratch-def.json'),
          setDefault: true,
        },
      ],
    });

    const defaultOrg = session.orgs.get('default');
    assert(defaultOrg?.username);
    scratchUsername = defaultOrg.username;
  });

  after(async () => {
    await session?.clean();
  });

  describe('--json --no-prompt', () => {
    it('returns an access token matching the expected pattern', () => {
      const result = execCmd<OrgAuthShowAccessTokenResult>(
        `org auth show-access-token --target-org ${scratchUsername} --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert(result);
      expect(result).to.have.property('accessToken');
      // NOTE: We assert truthiness instead of values so that a failure diff does not expose an access token.
      expect(accessTokenRegex.test(result.accessToken), 'accessToken should match the expected format').to.be.true;
    });

    it('includes the security warning in json output', () => {
      const output = execCmd<OrgAuthShowAccessTokenResult>(
        `org auth show-access-token --target-org ${scratchUsername} --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      assert(output);
      expect(output.warnings).to.be.an('array');
      expect(output.warnings?.some((w) => w.includes('Access Token'))).to.be.true;
    });
  });

  describe('--json (without --no-prompt)', () => {
    it('returns an access token without prompting', () => {
      const result = execCmd<OrgAuthShowAccessTokenResult>(
        `org auth show-access-token --target-org ${scratchUsername} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert(result);
      expect(result).to.have.property('accessToken');
      expect(accessTokenRegex.test(result.accessToken), 'accessToken should match the expected format').to.be.true;
    });
  });

  describe('--no-prompt (without --json)', () => {
    it('outputs a table containing the access token', () => {
      const output = execCmd(`org auth show-access-token --target-org ${scratchUsername} --no-prompt`, {
        ensureExitCode: 0,
      }).shellOutput.stdout;
      expect(output).to.include('Access Token');
      expect(accessTokenRegex.test(output), 'table output should contain a valid access token').to.be.true;
    });

    it('includes the security warning in stderr', () => {
      const stderr = execCmd(`org auth show-access-token --target-org ${scratchUsername} --no-prompt`, {
        ensureExitCode: 0,
      }).shellOutput.stderr;
      expect(stderr).to.include('Access Token');
    });
  });

  describe('default org resolution', () => {
    it('uses the default target-org when no --target-org is specified', () => {
      const result = execCmd<OrgAuthShowAccessTokenResult>('org auth show-access-token --no-prompt --json', {
        ensureExitCode: 0,
      }).jsonOutput?.result;
      assert(result);
      expect(result).to.have.property('accessToken');
      expect(accessTokenRegex.test(result.accessToken), 'accessToken should match the expected format').to.be.true;
    });
  });

  describe('errors', () => {
    it('fails when target org does not exist', () => {
      const output = execCmd('org auth show-access-token --target-org nonexistent@user.org --no-prompt --json', {
        ensureExitCode: 1,
      }).jsonOutput;
      assert(output);
      expect(output.status).to.equal(1);
    });
  });
});
