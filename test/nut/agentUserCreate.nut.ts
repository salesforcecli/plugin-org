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
import path from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentUserCreateResponse } from '../../src/commands/org/create/agent-user.js';

describe('org:create:agent-user NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: { sourceDir: path.join('test', 'nut', 'agent-project') },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          alias: 'agentOrg',
          config: path.join('config', 'project-scratch-def.json'),
        },
      ],
    });
  });

  after(async () => {
    await session?.clean();
    delete process.env.AGENT_USER;
  });

  describe('create agent user', () => {
    let scratchOrgUsername: string;

    it('should create an agent user with default settings', () => {
      const result = execCmd<AgentUserCreateResponse>('org:create:agent-user --target-org agentOrg --json', {
        ensureExitCode: 0,
      }).jsonOutput?.result;

      expect(result).to.have.property('userId');
      expect(result).to.have.property('username');
      scratchOrgUsername = result!.username;
      process.env.AGENT_USER = scratchOrgUsername;
      expect(result).to.have.property('profileId');
      expect(result).to.have.property('permissionSetsAssigned');
      expect(result).to.have.property('permissionSetErrors');

      // Verify username format
      expect(result?.username).to.match(/^agent\.user\.[a-f0-9]{12}@.+$/);

      // Verify permission sets were assigned
      expect(result?.permissionSetsAssigned).to.be.an('array');
      expect(result?.permissionSetsAssigned).to.include.members([
        'AgentforceServiceAgentBase',
        'AgentforceServiceAgentUser',
        'EinsteinGPTPromptTemplateUser',
      ]);

      // Verify no errors
      expect(result?.permissionSetErrors).to.be.an('array').that.is.empty;
    });

    it('should create an agent user with custom base username', () => {
      const result = execCmd<AgentUserCreateResponse>(
        'org:create:agent-user --target-org agentOrg --base-username service-agent@test.com --json',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;

      expect(result).to.have.property('userId');
      expect(result).to.have.property('username');

      // Verify username format with custom base
      expect(result?.username).to.match(/^service-agent\.[a-f0-9]{12}@test\.com$/);
    });

    it('should create an agent user with custom first and last name', () => {
      const result = execCmd<AgentUserCreateResponse>(
        'org:create:agent-user --target-org agentOrg --first-name Service --last-name Bot --json',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;

      expect(result).to.have.property('userId');
      expect(result).to.have.property('username');
    });

    it('should fail with invalid base username format', () => {
      const error = execCmd('org:create:agent-user --target-org agentOrg --base-username invalidformat --json', {
        ensureExitCode: 'nonZero',
      }).jsonOutput;

      expect(error?.name).to.equal('InvalidBaseUsernameError');
      expect(error?.message).to.include('Must include @ symbol');
      expect(error?.actions).to.include('Provide a base username in email format, e.g., service-agent@corp.com');
    });
  });
});
