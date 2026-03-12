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
import { Connection, SfError } from '@salesforce/core';
import sinon from 'sinon';
import OrgCreateAgentUser from '../../../../src/commands/org/create/agent-user.js';

describe('org:create:agent-user', () => {
  let sandbox: sinon.SinonSandbox;
  let connectionStub: sinon.SinonStubbedInstance<Connection>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    connectionStub = sandbox.createStubInstance(Connection);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Permission Set Assignment Errors', () => {
    it('should throw PermissionSetAssignmentError when permission set is not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const command = new OrgCreateAgentUser([], {} as any);

      // Stub the query to return no permission sets
      connectionStub.query.resolves({
        totalSize: 0,
        done: true,
        records: [],
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const { assigned, errors } = await (command as any).assignPermissionSets(connectionStub, 'userId123', [
        'NonExistentPermSet',
      ]);
      expect(assigned).to.be.empty;
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].permissionSet).to.equal('NonExistentPermSet');
      expect(errors[0].error).to.equal('Permission set not found in org');
    });

    it('should throw PermissionSetAssignmentError when assignment fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const command = new OrgCreateAgentUser([], {} as any);

      // Stub the query to return a permission set
      connectionStub.query.resolves({
        totalSize: 1,
        done: true,
        records: [{ Id: 'ps123' }],
      });

      // Stub sobject to return failure on assignment
      const sobjectStub = {
        create: sandbox.stub().resolves({
          success: false,
          errors: [{ message: 'Assignment failed due to licensing' }],
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      connectionStub.sobject.returns(sobjectStub as any);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const { assigned, errors } = await (command as any).assignPermissionSets(connectionStub, 'userId123', [
        'TestPermSet',
      ]);

      expect(assigned).to.be.empty;
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].permissionSet).to.equal('TestPermSet');
      expect(errors[0].error).to.include('Assignment failed due to licensing');
    });
  });

  describe('Profile Lookup Errors', () => {
    it('should throw ProfileQueryError when profile query fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const command = new OrgCreateAgentUser([], {} as any);

      // Stub singleRecordQuery to throw an error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (connectionStub as any).singleRecordQuery = sandbox
        .stub()
        .rejects(new Error("INVALID_TYPE: sObject type 'Profile' is not supported"));

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        await (command as any).getProfileId(connectionStub);
        expect.fail('Should have thrown ProfileQueryError');
      } catch (error) {
        expect(error).to.be.instanceOf(SfError);
        const sfError = error as SfError;
        expect(sfError.name).to.equal('ProfileQueryError');
        expect(sfError.message).to.include('Failed to query for "Einstein Agent User" profile');
        expect(sfError.message).to.include("sObject type 'Profile' is not supported");
        expect(sfError.actions).to.include('Ensure Agentforce is enabled in your org');
      }
    });

    it('should throw ProfileQueryError when profile query fails with generic error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const command = new OrgCreateAgentUser([], {} as any);

      // Stub singleRecordQuery to throw a generic error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (connectionStub as any).singleRecordQuery = sandbox.stub().rejects(new Error('Connection timeout'));

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        await (command as any).getProfileId(connectionStub);
        expect.fail('Should have thrown ProfileQueryError');
      } catch (error) {
        expect(error).to.be.instanceOf(SfError);
        const sfError = error as SfError;
        expect(sfError.name).to.equal('ProfileQueryError');
        expect(sfError.message).to.include('Connection timeout');
      }
    });
  });

  describe('License Check Query Errors', () => {
    it('should throw ProfileNotFoundError when Einstein Agent User profile does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const command = new OrgCreateAgentUser([], {} as any);

      // Stub query to return no profile
      connectionStub.query.resolves({
        totalSize: 0,
        done: true,
        records: [],
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        await (command as any).checkAgentUserLicenses(connectionStub);
        expect.fail('Should have thrown ProfileNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(SfError);
        const sfError = error as SfError;
        expect(sfError.name).to.equal('ProfileNotFoundError');
        expect(sfError.message).to.include('Einstein Agent User profile not found');
        expect(sfError.actions).to.include('Verify that Agentforce is enabled for your org');
      }
    });

    it('should throw NoAgentLicensesError when no license information is found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const command = new OrgCreateAgentUser([], {} as any);

      // Stub query to return profile without license info
      connectionStub.query.resolves({
        totalSize: 1,
        done: true,
        records: [{ UserLicense: null }],
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        await (command as any).checkAgentUserLicenses(connectionStub);
        expect.fail('Should have thrown NoAgentLicensesError');
      } catch (error) {
        expect(error).to.be.instanceOf(SfError);
        const sfError = error as SfError;
        expect(sfError.name).to.equal('NoAgentLicensesError');
        expect(sfError.message).to.include('No license information found');
        expect(sfError.actions).to.include('Contact your Salesforce account team');
      }
    });

    it('should throw NoAgentLicensesError when no licenses are provisioned', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const command = new OrgCreateAgentUser([], {} as any);

      // Stub query to return license with 0 total licenses
      connectionStub.query.resolves({
        totalSize: 1,
        done: true,
        records: [
          {
            UserLicense: {
              Id: 'license123',
              Name: 'Einstein Agent User',
              MasterLabel: 'Einstein Agent User',
              TotalLicenses: 0,
              UsedLicenses: 0,
            },
          },
        ],
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        await (command as any).checkAgentUserLicenses(connectionStub);
        expect.fail('Should have thrown NoAgentLicensesError');
      } catch (error) {
        expect(error).to.be.instanceOf(SfError);
        const sfError = error as SfError;
        expect(sfError.name).to.equal('NoAgentLicensesError');
        expect(sfError.message).to.include('No Einstein Agent User licenses are provisioned');
        expect(sfError.actions).to.include(
          'Contact your Salesforce account team to add Einstein Agent User licenses to your org'
        );
      }
    });

    it('should throw NoAvailableAgentLicensesError when all licenses are used', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const command = new OrgCreateAgentUser([], {} as any);

      // Stub query to return license with all licenses used
      connectionStub.query.resolves({
        totalSize: 1,
        done: true,
        records: [
          {
            UserLicense: {
              Id: 'license123',
              Name: 'Einstein Agent User',
              MasterLabel: 'Einstein Agent User',
              TotalLicenses: 5,
              UsedLicenses: 5,
            },
          },
        ],
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        await (command as any).checkAgentUserLicenses(connectionStub);
        expect.fail('Should have thrown NoAvailableAgentLicensesError');
      } catch (error) {
        expect(error).to.be.instanceOf(SfError);
        const sfError = error as SfError;
        expect(sfError.name).to.equal('NoAvailableAgentLicensesError');
        expect(sfError.message).to.include('No available Einstein Agent User licenses');
        expect(sfError.message).to.include('5/5 used');
        expect(sfError.actions).to.include('Remove an existing agent user to free up a license');
      }
    });
  });

  describe('Input Validation', () => {
    it('should throw InvalidBaseUsernameError for invalid base username format', () => {
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
});
