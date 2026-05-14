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

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { AuthInfo, Messages, SfError } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'org.auth.show-user-password');

export type OrgAuthShowUserPasswordResult = {
  password: string;
};

export default class OrgAuthShowUserPassword extends SfCommand<OrgAuthShowUserPasswordResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.no-prompt.summary'),
      char: 'p',
    }),
  };

  public async run(): Promise<OrgAuthShowUserPasswordResult> {
    const { flags } = await this.parse(OrgAuthShowUserPassword);

    const org = flags['target-org'];
    const username = org.getUsername();

    if (!this.jsonEnabled() && !flags['no-prompt']) {
      const confirmed = await this.confirm({
        message: messages.getMessage('prompt.show-user-password', [username]),
        ms: 30_000,
      });
      if (!confirmed) {
        throw new SfError('Show user password confirmation denied or timed out.');
      }
    } else {
      this.warn(messages.getMessage('warning.show-user-password'));
    }

    const authInfo = await AuthInfo.create({ username });
    const { password } = authInfo.getFields(true);

    if (!password) {
      throw messages.createError('error.noPassword', [username]);
    }

    this.table({
      overflow: 'wrap',
      data: [{ key: 'Password', value: password }],
    });

    return { password };
  }
}
