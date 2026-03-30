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

import { AuthInfo, AuthRemover, Messages, Org, SfError, StateAggregator } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { orgThatMightBeDeleted } from '../../../shared/flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete_sandbox');

export type SandboxDeleteResponse = {
  orgId: string;
  username: string;
};

export default class DeleteSandbox extends SfCommand<SandboxDeleteResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['env:delete:sandbox'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    'target-org': orgThatMightBeDeleted({
      summary: messages.getMessage('flags.target-org.summary'),
      required: true,
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.no-prompt.summary'),
    }),
  };

  public async run(): Promise<SandboxDeleteResponse> {
    const flags = (await this.parse(DeleteSandbox)).flags;
    const username = flags['target-org'];
    let orgId: string;

    try {
      const sbxAuthFields = (await AuthInfo.create({ username })).getFields();
      orgId = sbxAuthFields.orgId as string;
    } catch (error) {
      if (error instanceof SfError && error.name === 'NamedOrgNotFoundError') {
        error.actions = [
          `Ensure the alias or username for the ${username} org is correct.`,
          `Ensure the ${username} org has been authenticated with the CLI.`,
        ];
      }
      throw error;
    }

    // The StateAggregator identifies sandbox auth files with a pattern of
    // <sandbox_ID>.sandbox.json.  E.g., 00DZ0000009T3VZMA0.sandbox.json
    const stateAggregator = await StateAggregator.getInstance();
    const cliCreatedSandbox = await stateAggregator.sandboxes.hasFile(orgId);

    if (!cliCreatedSandbox) {
      throw messages.createError('error.unknownSandbox', [username]);
    }

    // Check if user has the DeleteSandbox PermissionSet in the sandbox
    try {
      const sandboxOrg = await Org.create({ aliasOrUsername: username });
      const hasDeleteSandboxPermission = await this.hasPermission(sandboxOrg, 'DeleteSandbox');
      this.debug('hasDeleteSandboxPermission %s ', hasDeleteSandboxPermission);
      if (!hasDeleteSandboxPermission) {
        throw messages.createError('error.insufficientPermissions', [username]);
      }
    } catch (error) {
      // If it's a permission error we created, re-throw it
      if (error instanceof SfError) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('required permission') || errorMessage.includes('DeleteSandbox')) {
          throw error;
        }
      }
      // For other errors (e.g., org connection issues), log a warning but continue
      // The actual delete operation will fail if permissions are truly insufficient
      if (error instanceof Error) {
        this.warn(messages.getMessage('warning.couldNotVerifyPermissions', [username]));
      }
    }

    if (flags['no-prompt'] || (await this.confirm({ message: messages.getMessage('prompt.confirm', [username]) }))) {
      try {
        const org = await Org.create({ aliasOrUsername: username });
        await org.delete();
        this.logSuccess(messages.getMessage('success', [username]));
      } catch (e) {
        if (e instanceof Error && e.name === 'DomainNotFoundError') {
          // the org has expired, so remote operations won't work
          // let's clean up the files locally
          const authRemover = await AuthRemover.create();
          await authRemover.removeAuth(username);
          this.logSuccess(messages.getMessage('success.Idempotent', [username]));
        } else if (e instanceof Error && e.name === 'SandboxNotFound') {
          this.logSuccess(messages.getMessage('success.Idempotent', [username]));
        } else {
          throw e;
        }
      }
    }
    return { username, orgId };
  }

  /**
   * Checks if the current user has a PermissionSet with the specified name assigned.
   *
   * @param org The org to check permissions in
   * @param permissionSetName The name of the PermissionSet to check (e.g., 'DeleteSandbox')
   * @returns True if the user has the PermissionSet assigned, false otherwise
   */
  // eslint-disable-next-line class-methods-use-this
  private async hasPermission(org: Org, permissionSetName: string): Promise<boolean> {
    try {
      const connection = org.getConnection();
      await org.refreshAuth();
      // try to get it from Identity API  
      const identity = await connection.identity();
      const userId = identity.user_id;

      if (!userId) {
        return false;
      }

      // Check if user has the PermissionSet assigned
      const permissionSetAssignmentQuery = `
      SELECT Id
      FROM PermissionSetAssignment
      WHERE AssigneeId = '${userId.replace(/'/g, "\\'")}'
      AND PermissionSet.Name = '${permissionSetName.replace(/'/g, "\\'")}'
      `;

      try {
        const permissionSetResult = await connection.query(permissionSetAssignmentQuery);
        return permissionSetResult.totalSize > 0;
      } catch {
        // If query fails, return false
        return false;
      }
    } catch {
      return false;
    }
  }
}
