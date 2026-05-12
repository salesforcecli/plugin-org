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
const messages = Messages.loadMessages('@salesforce/plugin-org', 'org.auth.show-access-token');

export type OrgAuthShowAccessTokenResult = {
  accessToken: string;
};

export default class OrgAuthShowAccessToken extends SfCommand<OrgAuthShowAccessTokenResult> {
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

  public async run(): Promise<OrgAuthShowAccessTokenResult> {
    const { flags } = await this.parse(OrgAuthShowAccessToken);

    const org = flags['target-org'];
    const username = org.getUsername();
    try {
      // The auth file can have a stale access token. Refresh it before getting the fields
      await org.refreshAuth();
    } catch (error) {
      // Even if this fails, we want to display the information we can read from the auth file
      this.warn('Unable to refresh auth for org. Access token may be stale.');
    }

    // Don't ask for confirmation if --json or --no-prompt is passed
    if (!this.jsonEnabled() && !flags['no-prompt']) {
      const confirmed = await this.confirm({
        message: messages.getMessage('prompt.show-access-token', [username]),
      });
      if (!confirmed) {
        throw new SfError('Show access token confirmation denied.');
      }
    } else {
      // Note: We don't show this warning if the user has already been prompted
      this.warn(messages.getMessage('warning.show-access-token'));
    }

    const authInfo = await AuthInfo.create({ username });
    const { accessToken } = authInfo.getFields(true);

    if (!accessToken) {
      throw messages.createError('error.noAccessToken', [username]);
    }

    this.table({
      overflow: 'wrap',
      data: [{ key: 'Access Token', value: accessToken }],
    });

    return { accessToken };
  }
}
