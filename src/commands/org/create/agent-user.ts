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

import { randomUUID } from 'node:crypto';
import { Connection, Messages, SfError } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create_agent_user');

export type AgentUserCreateResponse = {
  userId: string;
  username: string;
  profileId: string;
  permissionSetsAssigned: string[];
  permissionSetErrors: Array<{ permissionSet: string; error: string }>;
};

export default class OrgCreateAgentUser extends SfCommand<AgentUserCreateResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    username: Flags.string({
      summary: messages.getMessage('flags.username.summary'),
      description: messages.getMessage('flags.username.description'),
      exclusive: ['base-username'],
    }),
    'base-username': Flags.string({
      summary: messages.getMessage('flags.base-username.summary'),
      description: messages.getMessage('flags.base-username.description'),
      exclusive: ['username'],
    }),
    'first-name': Flags.string({
      summary: messages.getMessage('flags.first-name.summary'),
      default: 'Agent',
    }),
    'last-name': Flags.string({
      summary: messages.getMessage('flags.last-name.summary'),
      default: 'User',
    }),
  };

  public async run(): Promise<AgentUserCreateResponse> {
    const { flags } = await this.parse(OrgCreateAgentUser);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    // Generate username
    const username = await this.generateUsername(connection, flags.username, flags['base-username']);
    this.log(`Generated username: ${username}`);

    // Always check for available agent user licenses
    await this.checkAgentUserLicenses(connection);

    // Always use Einstein Agent User profile
    const profileId = await this.getProfileId(connection);
    this.log('Using profile: Einstein Agent User');

    // Create the agent user
    const userId = await this.createAgentUser(connection, username, profileId, {
      firstName: flags['first-name'],
      lastName: flags['last-name'],
    });
    this.log(`Agent user created successfully: ${userId}`);

    // Always assign the required permission sets
    const requiredPermissionSets = [
      'AgentforceServiceAgentBase',
      'AgentforceServiceAgentUser',
      'EinsteinGPTPromptTemplateUser',
    ];

    // Assign permission sets
    const { assigned, errors } = await this.assignPermissionSets(connection, userId, requiredPermissionSets);

    // Fail if any required permission sets could not be assigned
    if (errors.length > 0) {
      const errorDetails = errors.map(({ permissionSet, error }) => `  - ${permissionSet}: ${error}`).join('\n');
      throw new SfError(
        `Agent user created but failed to assign required permission sets:\n${errorDetails}\n\nThe user may not function correctly without these permission sets.`,
        'PermissionSetAssignmentError',
        [
          'Verify that the permission sets exist in your org',
          'Check that you have permission to assign permission sets',
          'Ensure Agentforce is properly configured in your org',
          `Manually assign the missing permission sets to user ${username}`,
        ]
      );
    }

    this.logSuccess(`Agent user created successfully with username: ${username}`);

    return {
      userId,
      username,
      profileId,
      permissionSetsAssigned: assigned,
      permissionSetErrors: errors,
    };
  }

  private async generateUsername(
    connection: Connection,
    username: string | undefined,
    baseUsername: string | undefined
  ): Promise<string> {
    // If explicit username provided, validate it's unique
    if (username) {
      const existingUser = await this.checkUsernameExists(connection, username);
      if (existingUser) {
        throw new SfError(
          `Username "${username}" already exists in the Salesforce universe. Usernames must be globally unique.`,
          'UsernameExistsError',
          ['Choose a different username', 'Omit --username to auto-generate a unique username']
        );
      }
      return username;
    }

    // Generate username with GUID
    const guid = randomUUID().replace(/-/g, '').substring(0, 12);

    if (baseUsername) {
      // Validate base username format
      if (!baseUsername.includes('@')) {
        throw new SfError(
          `Invalid base username format: "${baseUsername}". Must include @ symbol.`,
          'InvalidBaseUsernameError',
          ['Provide a base username in email format, e.g., service-agent@corp.com']
        );
      }
      const [localPart, domain] = baseUsername.split('@');
      return `${localPart}.${guid}@${domain}`;
    }

    // Default: auto-generate based on org domain
    const orgIdentity = connection.getAuthInfoFields();
    const orgUsername = orgIdentity.username;
    if (!orgUsername) {
      throw new SfError('Unable to determine org username for generating agent user username', 'OrgUsernameError', [
        'Specify an explicit --username or --base-username',
      ]);
    }
    const domain = orgUsername.split('@')[1];
    return `agent.user.${guid}@${domain}`;
  }

  private async checkUsernameExists(connection: Connection, username: string): Promise<boolean> {
    try {
      const result = await connection.query<{ Id: string }>(`SELECT Id FROM User WHERE Username = '${username}'`);
      return result.totalSize > 0;
    } catch (error) {
      // If query fails, assume username might exist to be safe
      this.warn(`Unable to verify username uniqueness: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async checkAgentUserLicenses(connection: Connection): Promise<void> {
    // Query the Einstein Agent User profile to get its associated license
    const profileResult = await connection.query<{
      UserLicense: {
        Id: string;
        Name: string;
        MasterLabel: string;
        TotalLicenses: number;
        UsedLicenses: number;
      };
    }>(`
        SELECT UserLicense.Id, UserLicense.Name, UserLicense.MasterLabel,
               UserLicense.TotalLicenses, UserLicense.UsedLicenses
        FROM Profile
        WHERE Name = 'Einstein Agent User'
      `);

    if (profileResult.totalSize === 0) {
      throw new SfError(
        'Einstein Agent User profile not found in this org. This profile is required for agent users.',
        'ProfileNotFoundError',
        [
          'Verify that Agentforce is enabled for your org',
          'Contact your Salesforce account team to enable Agentforce features',
        ]
      );
    }

    const license = profileResult.records[0].UserLicense;
    if (!license) {
      throw new SfError(
        'No license information found for Einstein Agent User profile. This may indicate an org configuration issue.',
        'NoAgentLicensesError',
        ['Contact your Salesforce account team', 'Verify that Agentforce is properly configured in your org']
      );
    }

    // Check if licenses are available
    const availableLicenses = license.TotalLicenses - license.UsedLicenses;

    if (license.TotalLicenses === 0) {
      throw new SfError(
        `No ${license.MasterLabel} licenses are provisioned in this org. These licenses are required to create agent users.`,
        'NoAgentLicensesError',
        [
          `Contact your Salesforce account team to add ${license.MasterLabel} licenses to your org`,
          'Verify that Agentforce is enabled for your org',
        ]
      );
    }

    if (availableLicenses <= 0) {
      throw new SfError(
        `No available ${license.MasterLabel} licenses in this org. License usage: ${license.UsedLicenses}/${license.TotalLicenses} used`,
        'NoAvailableAgentLicensesError',
        [
          'Remove an existing agent user to free up a license',
          `Contact your Salesforce account team to add more ${license.MasterLabel} licenses`,
        ]
      );
    }

    // Log license availability
    this.log(`${license.MasterLabel}: ${availableLicenses} of ${license.TotalLicenses} licenses available`);
  }

  // eslint-disable-next-line class-methods-use-this
  private async getProfileId(connection: Connection): Promise<string> {
    try {
      // Use the Einstein Agent User profile which is specifically designed for agent users
      const profileResult = await connection.singleRecordQuery<{ Id: string }>(
        "SELECT Id FROM Profile WHERE Name='Einstein Agent User'"
      );

      return profileResult.Id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SfError(
        `Failed to query for "Einstein Agent User" profile: ${errorMessage}. This profile is required for agent users.`,
        'ProfileQueryError',
        [
          'Ensure Agentforce is enabled in your org',
          'Verify that the Einstein Agent User profile exists',
          'Check that you have permission to query Profile records',
          'Contact your Salesforce administrator to enable Agentforce features',
        ]
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private async createAgentUser(
    connection: Connection,
    username: string,
    profileId: string,
    nameFields: {
      firstName: string;
      lastName: string;
    }
  ): Promise<string> {
    // Generate alias from username (max 8 chars)
    // Take first part before @ or first 8 chars of username
    const aliasPart = username.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const alias = aliasPart.substring(0, 8);

    const userRecord = await connection.sobject('User').create({
      FirstName: nameFields.firstName,
      LastName: nameFields.lastName,
      Alias: alias,
      Email: username,
      Username: username,
      ProfileId: profileId,
      TimeZoneSidKey: 'America/Los_Angeles',
      LocaleSidKey: 'en_US',
      EmailEncodingKey: 'UTF-8',
      LanguageLocaleKey: 'en_US',
    });

    if (!userRecord.success || !userRecord.id) {
      const errorMessages = userRecord.errors?.map((e) => e.message).join(', ') ?? 'Unknown error';
      throw new SfError(`Failed to create agent user: ${errorMessages}`, 'UserCreationError', [
        'Verify that the username is globally unique',
        'Ensure the Einstein Agent User profile exists in your org',
        'Check that Agentforce is enabled for your org',
        'Verify you have permission to create User records',
      ]);
    }

    return userRecord.id;
  }

  private async assignPermissionSets(
    connection: Connection,
    userId: string,
    permissionSets: string[]
  ): Promise<{ assigned: string[]; errors: Array<{ permissionSet: string; error: string }> }> {
    const assigned: string[] = [];
    const errors: Array<{ permissionSet: string; error: string }> = [];

    for (const permissionSetName of permissionSets) {
      try {
        // Look up the permission set
        // eslint-disable-next-line no-await-in-loop
        const psResult = await connection.query<{ Id: string }>(
          `SELECT Id FROM PermissionSet WHERE Name = '${permissionSetName}' LIMIT 1`
        );

        if (psResult.totalSize === 0) {
          errors.push({
            permissionSet: permissionSetName,
            error: 'Permission set not found in org. It may not be available or the name may be incorrect.',
          });
          continue;
        }

        const permissionSetId = psResult.records[0].Id;

        // Check if already assigned
        // eslint-disable-next-line no-await-in-loop
        const existingAssignment = await connection.query<{ Id: string }>(
          `SELECT Id FROM PermissionSetAssignment WHERE PermissionSetId = '${permissionSetId}' AND AssigneeId = '${userId}' LIMIT 1`
        );

        if (existingAssignment.totalSize > 0) {
          assigned.push(permissionSetName);
          continue;
        }

        // Assign the permission set
        // eslint-disable-next-line no-await-in-loop
        const assignmentResult = await connection.sobject('PermissionSetAssignment').create({
          PermissionSetId: permissionSetId,
          AssigneeId: userId,
        });

        if (!assignmentResult.success) {
          const errorMessages = assignmentResult.errors?.map((e) => e.message).join(', ') ?? 'Unknown error';
          errors.push({
            permissionSet: permissionSetName,
            error: errorMessages,
          });
        } else {
          assigned.push(permissionSetName);
          this.log(`Assigned permission set: ${permissionSetName}`);
        }
      } catch (error) {
        errors.push({
          permissionSet: permissionSetName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { assigned, errors };
  }
}
