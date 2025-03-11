/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

  protected async openOrgUI(flags: OrgOpenFlags, frontDoorUrl: string, retUrl?: string): Promise<OrgOpenOutput> {
    const orgId = this.org.getOrgId();
    const url = `${frontDoorUrl}${retUrl ? `&retURL=${retUrl}` : ''}`;

    // TODO: better typings in sfdx-core for orgs read from auth files
    const username = this.org.getUsername() as string;
    const output = { orgId, url, username };
    // NOTE: Deliberate use of `||` here since getBoolean() defaults to false, and we need to consider both env vars.
    const containerMode = env.getBoolean('SF_CONTAINER_MODE') || env.getBoolean('SFDX_CONTAINER_MODE');

    // security warning only for --json OR --url-only OR containerMode
    if (flags['url-only'] || this.jsonEnabled() || containerMode) {
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
