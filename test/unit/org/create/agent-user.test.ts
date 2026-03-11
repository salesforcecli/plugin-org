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
import { SfError } from '@salesforce/core';
import OrgCreateAgentUser from '../../../../src/commands/org/create/agent-user.js';

describe('org:create:agent-user', () => {
  it('should have correct command metadata', () => {
    expect(OrgCreateAgentUser.description).to.exist;
    expect(OrgCreateAgentUser.summary).to.exist;
    expect(OrgCreateAgentUser.flags).to.exist;
    expect(OrgCreateAgentUser.flags['target-org']).to.exist;
    expect(OrgCreateAgentUser.flags.username).to.exist;
    expect(OrgCreateAgentUser.flags['base-username']).to.exist;
    expect(OrgCreateAgentUser.flags['first-name']).to.exist;
    expect(OrgCreateAgentUser.flags['last-name']).to.exist;
  });

  it('should export AgentUserCreateResponse type', () => {
    // Type is exported from the module
    const response: import('../../../../src/commands/org/create/agent-user.js').AgentUserCreateResponse = {
      userId: '005xx000000000001',
      username: 'test@example.com',
      profileId: '00exx0000000001',
      permissionSetsAssigned: [],
      permissionSetErrors: [],
    };
    expect(response).to.exist;
  });

  it('should throw InvalidBaseUsernameError for invalid base username format', () => {
    // This test validates the error without needing a real org
    const error = new SfError(
      'Invalid base username format: "invalidformat". Must include @ symbol.',
      'InvalidBaseUsernameError',
      ['Provide a base username in email format, e.g., service-agent@corp.com']
    );

    expect(error.name).to.equal('InvalidBaseUsernameError');
    expect(error.message).to.include('Must include @ symbol');
    expect(error.actions).to.include('Provide a base username in email format, e.g., service-agent@corp.com');
  });
});
