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

import { config as chaiConfig, expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { SfError } from '@salesforce/core';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { SinonStub } from 'sinon';
import OrgCreateAgentUser from '../../../../src/commands/org/create/agent-user.js';

chaiConfig.truncateThreshold = 0;

describe('org:create:agent-user', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let connectionQueryStub: SinonStub;
  let connectionSingleRecordQueryStub: SinonStub;
  let connectionSobjectStub: SinonStub;

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    testOrg.username = 'test@example.com';
    testOrg.orgId = '00Dxx0000000000';
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);

    // Default stubs for happy path
    connectionQueryStub = $$.SANDBOX.stub();
    connectionSingleRecordQueryStub = $$.SANDBOX.stub();
    connectionSobjectStub = $$.SANDBOX.stub();

    // Stub the connection methods
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    $$.SANDBOX.stub(testOrg, 'getConnection').returns({
      query: connectionQueryStub,
      singleRecordQuery: connectionSingleRecordQueryStub,
      sobject: connectionSobjectStub,
      getAuthInfoFields: () => ({ username: testOrg.username, userId: '005xx000000000001' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  describe('success scenarios', () => {
    beforeEach(() => {
      // Setup happy path stubs
      setupHappyPathStubs();
    });

    it('creates agent user with auto-generated username', async () => {
      const result = await OrgCreateAgentUser.run(['--target-org', testOrg.username]);

      expect(result.userId).to.equal('005xx000000000002');
      expect(result.username).to.include('agent.user.');
      expect(result.username).to.include('@example.com');
      expect(result.profileId).to.equal('00exx0000000001');
      expect(result.permissionSetsAssigned).to.have.length(3);
      expect(result.permissionSetErrors).to.have.length(0);
    });

    it('creates agent user with explicit username', async () => {
      const customUsername = 'myagent@test.com';
      // Username will be checked and should not exist (default behavior from setupAllQueryStubs)

      const result = await OrgCreateAgentUser.run(['--target-org', testOrg.username, '--username', customUsername]);

      expect(result.username).to.equal(customUsername);
      expect(result.userId).to.equal('005xx000000000002');
    });

    it('creates agent user with base-username', async () => {
      const result = await OrgCreateAgentUser.run([
        '--target-org',
        testOrg.username,
        '--base-username',
        'service@corp.com',
      ]);

      expect(result.username).to.match(/^service\.[a-z0-9]{12}@corp\.com$/);
      expect(result.userId).to.equal('005xx000000000002');
    });

    it('creates agent user with custom name fields', async () => {
      const result = await OrgCreateAgentUser.run([
        '--target-org',
        testOrg.username,
        '--first-name',
        'Service',
        '--last-name',
        'Bot',
      ]);

      expect(result.userId).to.equal('005xx000000000002');
      // Verify the create call had the right names
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const createCall = connectionSobjectStub().create.firstCall.args[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(createCall.FirstName).to.equal('Service');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(createCall.LastName).to.equal('Bot');
    });
  });

  describe('username validation', () => {
    beforeEach(() => {
      setupHappyPathStubs();
    });

    it('throws error when explicit username already exists', async () => {
      const existingUsername = 'existing@test.com';
      // Override the query stub to return that this username exists
      connectionQueryStub.callsFake((query: string) => {
        // License check query
        if (
          query &&
          query.includes('UserLicense') &&
          query.includes('Profile') &&
          query.includes('Einstein Agent User')
        ) {
          return Promise.resolve({
            totalSize: 1,
            records: [
              {
                UserLicense: {
                  Id: '100xx0000000001',
                  Name: 'PlatformAgentServiceAgent',
                  MasterLabel: 'Agentforce Service Agent',
                  TotalLicenses: 10,
                  UsedLicenses: 5,
                },
              },
            ],
          });
        }
        // Username check - return that it exists
        if (query && query.includes('SELECT Id FROM User WHERE Username') && query.includes(existingUsername)) {
          return Promise.resolve({
            totalSize: 1,
            records: [{ Id: '005xx000000000099' }],
          });
        }
        return Promise.resolve({ totalSize: 0, records: [] });
      });

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username, '--username', existingUsername]);
        expect.fail('should have thrown UsernameExistsError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('UsernameExistsError');
        expect(err.message).to.include('already exists');
        expect(err.actions).to.include('Choose a different username');
      }
    });

    it('throws error when base-username is missing @ symbol', async () => {
      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username, '--base-username', 'invalidusername']);
        expect.fail('should have thrown InvalidBaseUsernameError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('InvalidBaseUsernameError');
        expect(err.message).to.include('Must include @ symbol');
      }
    });
  });

  describe('license checking', () => {
    it('throws error when Einstein Agent User profile not found', async () => {
      setupMinimalStubs();
      connectionQueryStub.callsFake((query: string) => {
        if (
          query &&
          query.includes('UserLicense') &&
          query.includes('Profile') &&
          query.includes('Einstein Agent User')
        ) {
          return Promise.resolve({ totalSize: 0, records: [] });
        }
        return Promise.resolve({ totalSize: 0, records: [] });
      });

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown ProfileNotFoundError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('ProfileNotFoundError');
        expect(err.message).to.include('Einstein Agent User profile not found');
        expect(err.actions).to.include('Verify that Agentforce is enabled for your org');
      }
    });

    it('throws error when license has 0 total licenses provisioned', async () => {
      setupMinimalStubs();
      connectionQueryStub.callsFake((query: string) => {
        if (
          query &&
          query.includes('UserLicense') &&
          query.includes('Profile') &&
          query.includes('Einstein Agent User')
        ) {
          return Promise.resolve({
            totalSize: 1,
            records: [
              {
                UserLicense: {
                  Id: '100xx0000000001',
                  Name: 'PlatformAgentServiceAgent',
                  MasterLabel: 'Agentforce Service Agent',
                  TotalLicenses: 0,
                  UsedLicenses: 0,
                },
              },
            ],
          });
        }
        return Promise.resolve({ totalSize: 0, records: [] });
      });

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown NoAgentLicensesError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('NoAgentLicensesError');
        expect(err.message).to.include('No Agentforce Service Agent licenses are provisioned');
        expect(err.actions).to.include('Contact your Salesforce account team');
      }
    });

    it('throws error when no available agent licenses (all consumed)', async () => {
      setupMinimalStubs();
      connectionQueryStub.callsFake((query: string) => {
        if (
          query &&
          query.includes('UserLicense') &&
          query.includes('Profile') &&
          query.includes('Einstein Agent User')
        ) {
          return Promise.resolve({
            totalSize: 1,
            records: [
              {
                UserLicense: {
                  Id: '100xx0000000001',
                  Name: 'PlatformAgentServiceAgent',
                  MasterLabel: 'Agentforce Service Agent',
                  TotalLicenses: 5,
                  UsedLicenses: 5,
                },
              },
            ],
          });
        }
        return Promise.resolve({ totalSize: 0, records: [] });
      });

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown NoAvailableAgentLicensesError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('NoAvailableAgentLicensesError');
        expect(err.message).to.include('No available Agentforce Service Agent licenses');
        expect(err.message).to.include('5/5 used');
        expect(err.actions).to.include('Remove an existing agent user to free up a license');
      }
    });

    it('throws error with context when license check query fails', async () => {
      setupMinimalStubs();
      connectionQueryStub.callsFake((query: string) => {
        if (
          query &&
          query.includes('UserLicense') &&
          query.includes('Profile') &&
          query.includes('Einstein Agent User')
        ) {
          return Promise.reject(new Error('INSUFFICIENT_ACCESS: You do not have permission to query Profile'));
        }
        return Promise.resolve({ totalSize: 0, records: [] });
      });

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown LicenseCheckError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('LicenseCheckError');
        expect(err.message).to.include('Failed to check agent user license availability');
        expect(err.message).to.include('INSUFFICIENT_ACCESS');
        expect(err.actions).to.include('Check that you have permission to query UserLicense records');
      }
    });
  });

  describe('profile errors', () => {
    it('throws error with context when profile query fails', async () => {
      setupAllQueryStubs();
      setupLocaleStubs();

      connectionSingleRecordQueryStub
        .withArgs("SELECT Id FROM Profile WHERE Name='Einstein Agent User'")
        .rejects(new Error('INSUFFICIENT_ACCESS: You do not have permission to query Profile'));

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown ProfileQueryError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('ProfileQueryError');
        expect(err.message).to.include('Failed to query for "Einstein Agent User" profile');
        expect(err.message).to.include('INSUFFICIENT_ACCESS');
        expect(err.actions).to.include('Check that you have permission to query Profile records');
        expect(err.actions).to.include('Ensure Agentforce is enabled in your org');
      }
    });

    it('throws error when profile not found (SingleRecordQuery throws)', async () => {
      setupAllQueryStubs();
      setupLocaleStubs();

      connectionSingleRecordQueryStub
        .withArgs("SELECT Id FROM Profile WHERE Name='Einstein Agent User'")
        .rejects(new Error('No records found'));

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown ProfileQueryError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('ProfileQueryError');
        expect(err.message).to.include('Failed to query for "Einstein Agent User" profile');
        expect(err.message).to.include('No records found');
      }
    });
  });

  describe('user creation errors', () => {
    it('throws error when user creation fails', async () => {
      setupAllQueryStubs();
      setupLocaleStubs();
      setupProfileStubs();

      connectionSobjectStub.withArgs('User').returns({
        create: $$.SANDBOX.stub().resolves({
          success: false,
          errors: [{ message: 'DUPLICATE_USERNAME: duplicate value found' }],
        }),
      });

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown UserCreationError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('UserCreationError');
        expect(err.message).to.include('Failed to create agent user');
        expect(err.message).to.include('DUPLICATE_USERNAME');
      }
    });
  });

  describe('permission set assignment errors', () => {
    it('fails when any required permission set cannot be assigned', async () => {
      setupLocaleStubs();
      setupProfileStubs();
      setupUserCreationStubs();

      // Override query stub to handle permission set lookup - second one not found
      connectionQueryStub.callsFake((query: string) => {
        // License check
        if (
          query &&
          query.includes('UserLicense') &&
          query.includes('Profile') &&
          query.includes('Einstein Agent User')
        ) {
          return Promise.resolve({
            totalSize: 1,
            records: [
              {
                UserLicense: {
                  Id: '100xx0000000001',
                  Name: 'PlatformAgentServiceAgent',
                  MasterLabel: 'Agentforce Service Agent',
                  TotalLicenses: 10,
                  UsedLicenses: 5,
                },
              },
            ],
          });
        }
        // Username check
        if (query && query.includes('SELECT Id FROM User WHERE Username')) {
          return Promise.resolve({ totalSize: 0, records: [] });
        }
        // Permission set lookups - AgentforceServiceAgentUser not found
        if (query && query.includes("Name = 'AgentforceServiceAgentUser'")) {
          return Promise.resolve({ totalSize: 0, records: [] });
        }
        if (query && query.includes('PermissionSet') && query.includes('Name') && !query.includes('Assignment')) {
          return Promise.resolve({
            totalSize: 1,
            records: [{ Id: '0PSxx0000000001' }],
          });
        }
        // Permission set assignment checks
        if (query && query.includes('PermissionSetAssignment')) {
          return Promise.resolve({ totalSize: 0, records: [] });
        }
        return Promise.resolve({ totalSize: 0, records: [] });
      });

      connectionSobjectStub.withArgs('PermissionSetAssignment').returns({
        create: $$.SANDBOX.stub().resolves({ success: true, id: '0PAxx0000000001' }),
      });

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown PermissionSetAssignmentError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('PermissionSetAssignmentError');
        expect(err.message).to.include('failed to assign required permission sets');
        expect(err.message).to.include('AgentforceServiceAgentUser');
        expect(err.message).to.include('Permission set not found in org');
        expect(err.actions).to.include('Verify that the permission sets exist in your org');
      }
    });

    it('fails when permission set assignment create fails', async () => {
      setupAllQueryStubs();
      setupLocaleStubs();
      setupProfileStubs();
      setupUserCreationStubs();

      // Set up sobject stubs for both User and PermissionSetAssignment
      connectionSobjectStub.callsFake((objectType: string) => {
        if (objectType === 'User') {
          return {
            create: $$.SANDBOX.stub().resolves({
              success: true,
              id: '005xx000000000002',
            }),
          };
        }
        if (objectType === 'PermissionSetAssignment') {
          return {
            create: $$.SANDBOX.stub().resolves({
              success: false,
              errors: [{ message: 'INSUFFICIENT_ACCESS: You do not have permission to assign permission sets' }],
            }),
          };
        }
        return {};
      });

      try {
        await OrgCreateAgentUser.run(['--target-org', testOrg.username]);
        expect.fail('should have thrown PermissionSetAssignmentError');
      } catch (e) {
        const err = e as SfError;
        expect(err.name).to.equal('PermissionSetAssignmentError');
        expect(err.message).to.include('failed to assign required permission sets');
        expect(err.message).to.include('INSUFFICIENT_ACCESS');
      }
    });
  });

  // Helper functions to set up stubs
  function setupMinimalStubs() {
    // Minimal stubs - intentionally empty so tests can fail fast if they don't set up required stubs
  }

  function setupAllQueryStubs() {
    // Comprehensive query stub that handles all query types
    connectionQueryStub.callsFake((query: string) => {
      // License check query (Profile with UserLicense)
      if (
        query &&
        query.includes('UserLicense') &&
        query.includes('Profile') &&
        query.includes('Einstein Agent User')
      ) {
        return Promise.resolve({
          totalSize: 1,
          records: [
            {
              UserLicense: {
                Id: '100xx0000000001',
                Name: 'PlatformAgentServiceAgent',
                MasterLabel: 'Agentforce Service Agent',
                TotalLicenses: 10,
                UsedLicenses: 5,
              },
            },
          ],
        });
      }
      // Username existence check
      if (query && query.includes('SELECT Id FROM User WHERE Username')) {
        return Promise.resolve({ totalSize: 0, records: [] });
      }
      // Permission set lookups
      if (query && query.includes('PermissionSet') && query.includes('Name') && !query.includes('Assignment')) {
        const psName = query.match(/'([^']+)'/)?.[1];
        if (psName) {
          return Promise.resolve({
            totalSize: 1,
            records: [{ Id: `0PS${Math.random().toString(36).substr(2, 9)}` }],
          });
        }
      }
      // Permission set assignment checks
      if (query && query.includes('PermissionSetAssignment')) {
        return Promise.resolve({ totalSize: 0, records: [] });
      }
      // Default
      return Promise.resolve({ totalSize: 0, records: [] });
    });
  }

  function setupLocaleStubs() {
    connectionSingleRecordQueryStub
      .withArgs(
        $$.SANDBOX.match(/SELECT TimeZoneSidKey, LocaleSidKey, EmailEncodingKey, LanguageLocaleKey FROM User WHERE/)
      )
      .resolves({
        TimeZoneSidKey: 'America/Los_Angeles',
        LocaleSidKey: 'en_US',
        EmailEncodingKey: 'UTF-8',
        LanguageLocaleKey: 'en_US',
      });
  }

  function setupProfileStubs() {
    connectionSingleRecordQueryStub
      .withArgs("SELECT Id FROM Profile WHERE Name='Einstein Agent User'")
      .resolves({ Id: '00exx0000000001' });
  }

  function setupUserCreationStubs() {
    connectionSobjectStub.withArgs('User').returns({
      create: $$.SANDBOX.stub().resolves({
        success: true,
        id: '005xx000000000002',
      }),
    });
  }

  function setupPermissionSetStubs() {
    // Already handled in setupAllQueryStubs
    // Just set up the sobject stub for permission set assignment
    connectionSobjectStub.withArgs('PermissionSetAssignment').returns({
      create: $$.SANDBOX.stub().resolves({ success: true, id: '0PAxx0000000001' }),
    });
  }

  function setupHappyPathStubs() {
    setupAllQueryStubs();
    setupLocaleStubs();
    setupProfileStubs();
    setupUserCreationStubs();
    setupPermissionSetStubs();
  }
});
