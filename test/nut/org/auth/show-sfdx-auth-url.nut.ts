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
import { sfdxAuthUrlRegex } from '@salesforce/core';
import { OrgAuthShowSfdxAuthUrlResult } from '../../../../src/commands/org/auth/show-sfdx-auth-url.js';

describe('org auth show-sfdx-auth-url NUTs', () => {
  let session: TestSession;
  let scratchUsername: string;

  before(async () => {
    session = await TestSession.create({
      project: { name: 'showAuthUrl' },
      // ------------------------------
      // NOTE: This will fail locally
      //       unless you have set the
      //       TESTKIT_AUTH_URL env var
      // ------------------------------
      devhubAuthStrategy: 'AUTH_URL',
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
    it('returns an SFDX auth URL matching the expected pattern', () => {
      const result = execCmd<OrgAuthShowSfdxAuthUrlResult>(
        `org auth show-sfdx-auth-url --target-org ${scratchUsername} --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert(result);
      expect(result).to.have.property('sfdxAuthUrl');
      // NOTE: We assert truthiness instead of values so that a failure diff does not expose credentials.
      expect(sfdxAuthUrlRegex.test(result.sfdxAuthUrl), 'sfdxAuthUrl should match the expected format').to.be.true;
    });

    it('includes the security warning in json output', () => {
      const output = execCmd<OrgAuthShowSfdxAuthUrlResult>(
        `org auth show-sfdx-auth-url --target-org ${scratchUsername} --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      assert(output);
      expect(output.warnings).to.be.an('array');
      expect(output.warnings?.some((w) => w.includes('Auth URL'))).to.be.true;
    });
  });

  describe('--json (without --no-prompt)', () => {
    it('returns an SFDX auth URL without prompting', () => {
      const result = execCmd<OrgAuthShowSfdxAuthUrlResult>(
        `org auth show-sfdx-auth-url --target-org ${scratchUsername} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert(result);
      expect(result).to.have.property('sfdxAuthUrl');
      expect(sfdxAuthUrlRegex.test(result.sfdxAuthUrl), 'sfdxAuthUrl should match the expected format').to.be.true;
    });
  });

  describe('--no-prompt (without --json)', () => {
    it('outputs a table containing the auth URL', () => {
      const output = execCmd(`org auth show-sfdx-auth-url --target-org ${scratchUsername} --no-prompt`, {
        ensureExitCode: 0,
      }).shellOutput.stdout;
      expect(output).to.include('SFDX Auth URL');
      expect(sfdxAuthUrlRegex.test(output), 'table output should contain a valid SFDX auth URL').to.be.true;
    });

    it('includes the security warning in stderr', () => {
      const stderr = execCmd(`org auth show-sfdx-auth-url --target-org ${scratchUsername} --no-prompt`, {
        ensureExitCode: 0,
      }).shellOutput.stderr;
      expect(stderr).to.include('Auth URL');
    });
  });

  describe('default org resolution', () => {
    it('uses the default target-org when no --target-org is specified', () => {
      const result = execCmd<OrgAuthShowSfdxAuthUrlResult>('org auth show-sfdx-auth-url --no-prompt --json', {
        ensureExitCode: 0,
      }).jsonOutput?.result;
      assert(result);
      expect(result).to.have.property('sfdxAuthUrl');
      expect(sfdxAuthUrlRegex.test(result.sfdxAuthUrl), 'sfdxAuthUrl should match the expected format').to.be.true;
    });
  });

  describe('errors', () => {
    it('fails when target org does not exist', () => {
      const output = execCmd('org auth show-sfdx-auth-url --target-org nonexistent@user.org --no-prompt --json', {
        ensureExitCode: 1,
      }).jsonOutput;
      assert(output);
      expect(output.status).to.equal(1);
    });
  });
});
