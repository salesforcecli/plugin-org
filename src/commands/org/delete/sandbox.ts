/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, SfError } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete_sandbox');

export interface SandboxDeleteResponse {
  orgId: string;
  username: string;
}
export default class EnvDeleteSandbox extends SfCommand<SandboxDeleteResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['env:delete:sandbox'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      required: true,
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.no-prompt.summary'),
    }),
  };
  public static readonly state = 'beta';

  public async run(): Promise<SandboxDeleteResponse> {
    const flags = (await this.parse(EnvDeleteSandbox)).flags;
    const org = flags['target-org'];
    const username = org.getUsername();
    if (!username) {
      throw new SfError('The org does not have a username.');
    }

    if (!(await org.isSandbox())) {
      throw messages.createError('error.isNotSandbox', [username]);
    }

    if (flags['no-prompt'] || (await this.confirm(messages.getMessage('prompt.confirm', [username])))) {
      try {
        await org.delete();
        this.logSuccess(messages.getMessage('success', [username]));
      } catch (e) {
        if (e instanceof Error && e.name === 'SandboxNotFound') {
          this.logSuccess(messages.getMessage('success.Idempotent', [username]));
        } else {
          throw e;
        }
      }
    }
    return { username, orgId: org.getOrgId() };
  }
}
