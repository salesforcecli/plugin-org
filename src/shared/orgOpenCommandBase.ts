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

import { platform } from 'node:os';
import { apps } from 'open';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages, Org, SfdcUrl, SfError } from '@salesforce/core';
import { env } from '@salesforce/kit';
import utils, { handleDomainError } from './orgOpenUtils.js';
import { type OrgOpenOutput } from './orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');

type OrgOpenFlags = {
  'url-only': boolean;
  browser?: 'chrome' | 'firefox' | 'edge';
  path?: string;
  private: boolean;
};

export abstract class OrgOpenCommandBase<T> extends SfCommand<T> {
  public static enableJsonFlag = true;

  // Set by concrete classes in `run()`
  protected org!: Org;
  protected connection!: Connection;

  protected async openOrgUI(flags: OrgOpenFlags, url: string): Promise<OrgOpenOutput> {
    const orgId = this.org.getOrgId();

    // TODO: better typings in sfdx-core for orgs read from auth files
    const username = this.org.getUsername() as string;
    const output = { orgId, url, username };
    // NOTE: Deliberate use of `||` here since getBoolean() defaults to false, and we need to consider both env vars.
    const containerMode = env.getBoolean('SF_CONTAINER_MODE') || env.getBoolean('SFDX_CONTAINER_MODE');

    // security warning only for --url-only OR containerMode
    if (flags['url-only'] || containerMode) {
      const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');
      this.warn(sharedMessages.getMessage('SecurityWarning'));
      this.log('');
    }

    if (containerMode) {
      // instruct the user that they need to paste the URL into the browser
      this.styledHeader('Action Required!');
      this.log(messages.getMessage('containerAction', [orgId, url]));
      return output;
    }

    if (flags['url-only']) {
      // this includes the URL
      this.logSuccess(messages.getMessage('humanSuccess', [orgId, username, url]));
      return output;
    }

    this.logSuccess(messages.getMessage('humanSuccessNoUrl', [orgId, username]));
    // we actually need to open the org
    try {
      this.spinner.start(messages.getMessage('domainWaiting'));
      await new SfdcUrl(url).checkLightningDomain();
      this.spinner.stop();
    } catch (err) {
      handleDomainError(err, url, env);
    }

    const cp = await utils.openUrl(url, {
      ...(flags.browser ? { app: { name: apps[flags.browser] } } : {}),
      ...(flags.private ? { newInstance: platform() === 'darwin', app: { name: apps.browserPrivate } } : {}),
    });
    cp.on('error', (err) => {
      throw SfError.wrap(err);
    });

    return output;
  }
}
