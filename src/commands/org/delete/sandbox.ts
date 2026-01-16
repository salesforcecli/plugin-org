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
}
