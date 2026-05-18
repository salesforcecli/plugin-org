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
import { OrgAuthShowUserPasswordResult } from '../../../../src/commands/org/auth/show-user-password.js';

describe('org auth show-user-password NUTs', () => {
  let session: TestSession;
  let scratchUsername: string;

  before(async () => {
    session = await TestSession.create({
      project: { name: 'showUserPassword' },
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

    // Generate a password for the scratch org user
    execCmd(`org generate password --target-org ${scratchUsername}`, { ensureExitCode: 0 });
  });

  after(async () => {
    await session?.clean();
  });

  describe('--json --no-prompt', () => {
    it('returns a password', () => {
      const result = execCmd<OrgAuthShowUserPasswordResult>(
        `org auth show-user-password --target-org ${scratchUsername} --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert(result);
      expect(result).to.have.property('password');
      // NOTE: We assert truthiness instead of values so that a failure diff does not expose credentials.
      expect(result.password.length > 0, 'password should not be empty').to.be.true;
    });

    it('includes the security warning in json output', () => {
      const output = execCmd<OrgAuthShowUserPasswordResult>(
        `org auth show-user-password --target-org ${scratchUsername} --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      assert(output);
      expect(output.warnings).to.be.an('array');
      expect(output.warnings?.some((w) => w.includes('password'))).to.be.true;
    });
  });

  describe('--json (without --no-prompt)', () => {
    it('returns a password without prompting', () => {
      const result = execCmd<OrgAuthShowUserPasswordResult>(
        `org auth show-user-password --target-org ${scratchUsername} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert(result);
      expect(result.password.length > 0, 'password should not be empty').to.be.true;
    });
  });

  describe('--no-prompt (without --json)', () => {
    it('outputs a table containing the password', () => {
      const output = execCmd(`org auth show-user-password --target-org ${scratchUsername} --no-prompt`, {
        ensureExitCode: 0,
      }).shellOutput.stdout;
      expect(output).to.include('Password');
    });

    it('includes the security warning in stderr', () => {
      const stderr = execCmd(`org auth show-user-password --target-org ${scratchUsername} --no-prompt`, {
        ensureExitCode: 0,
      }).shellOutput.stderr;
      expect(stderr).to.include('password');
    });
  });

  describe('default org resolution', () => {
    it('uses the default target-org when no --target-org is specified', () => {
      const result = execCmd<OrgAuthShowUserPasswordResult>('org auth show-user-password --no-prompt --json', {
        ensureExitCode: 0,
      }).jsonOutput?.result;
      assert(result);
      expect(result.password.length > 0, 'password should not be empty').to.be.true;
    });
  });

  describe('errors', () => {
    it('fails when target org does not exist', () => {
      const output = execCmd('org auth show-user-password --target-org nonexistent@user.org --no-prompt --json', {
        ensureExitCode: 1,
      }).jsonOutput;
      assert(output);
      expect(output.status).to.equal(1);
    });
  });
});
