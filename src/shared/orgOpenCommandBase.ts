/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import fs from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import isWsl from 'is-wsl';
import { apps } from 'open';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages, Org, SfdcUrl, SfError } from '@salesforce/core';
import { env, sleep } from '@salesforce/kit';
import utils, { fileCleanup, getFileContents, handleDomainError } from './orgOpenUtils.js';
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
    const url = `${frontDoorUrl}${
      retUrl
        ? `&${frontDoorUrl.includes('.jsp?otp=') ? `startURL=${encodeURIComponent(retUrl)}` : `retURL=${retUrl}`}`
        : ''
    }`;

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

    if (this.jsonEnabled()) {
      // TODO: remove this code path once the org open behavior changes on August 2025 (see W-17661469)
      // create a local html file that contains the POST stuff.
      const tempFilePath = path.join(tmpdir(), `org-open-${new Date().valueOf()}.html`);
      await fs.promises.writeFile(
        tempFilePath,
        getFileContents(
          this.connection.accessToken as string,
          this.connection.instanceUrl,
          // the path flag is URI-encoded in its `parse` func.
          // For the form redirect to work we need it decoded.
          flags.path ? decodeURIComponent(flags.path) : retUrl
        )
      );
      const filePathUrl = isWsl
        ? 'file:///' + execSync(`wslpath -m ${tempFilePath}`).toString().trim()
        : `file:///${tempFilePath}`;
      const cp = await utils.openUrl(filePathUrl, {
        ...(flags.browser ? { app: { name: apps[flags.browser] } } : {}),
        ...(flags.private ? { newInstance: platform() === 'darwin', app: { name: apps.browserPrivate } } : {}),
      });
      cp.on('error', (err) => {
        fileCleanup(tempFilePath);
        throw SfError.wrap(err);
      });
      // so we don't delete the file while the browser is still using it
      // open returns when the CP is spawned, but there's not way to know if the browser is still using the file
      await sleep(platform() === 'win32' || isWsl ? 7000 : 5000);
      fileCleanup(tempFilePath);
    } else {
      // it means we generated a one-time use frontdoor url
      // so the workaround to create a local html file is not needed
      const cp = await utils.openUrl(url, {
        ...(flags.browser ? { app: { name: apps[flags.browser] } } : {}),
        ...(flags.private ? { newInstance: platform() === 'darwin', app: { name: apps.browserPrivate } } : {}),
      });
      cp.on('error', (err) => {
        throw SfError.wrap(err);
      });
    }

    return output;
  }
}
