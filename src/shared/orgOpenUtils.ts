/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { rmSync } from 'node:fs';
import { ChildProcess } from 'node:child_process';
import open, { Options } from 'open';
import { Connection, Logger, Messages, Org, SfError } from '@salesforce/core';
import { Duration, Env } from '@salesforce/kit';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');

export const openUrl = async (url: string, options: Options): Promise<ChildProcess> => open(url, options);

export const fileCleanup = (tempFilePath: string): void =>
  rmSync(tempFilePath, { force: true, maxRetries: 3, recursive: true });

type SingleAccessUrlRes = { frontdoor_uri: string | undefined };

/**
 * This method generates and returns a frontdoor url for the given org.
 *
 * @param org org for which we generate the frontdoor url.
 * @param conn the Connection for the given Org.
 * @param singleUseUrl if true returns a single-use url frontdoor url.
 */
export const buildFrontdoorUrl = async (org: Org, conn: Connection, singleUseUrl: boolean): Promise<string> => {
  await org.refreshAuth(); // we need a live accessToken for the frontdoor url
  const accessToken = conn.accessToken;
  if (!accessToken) {
    throw new SfError('NoAccessToken', 'NoAccessToken');
  }
  if (singleUseUrl) {
    try {
      const response: SingleAccessUrlRes = await conn.requestGet('/services/oauth2/singleaccess');
      if (response.frontdoor_uri) return response.frontdoor_uri;
      throw new SfError(sharedMessages.getMessage('SingleAccessFrontdoorError')).setData(response);
    } catch (e) {
      if (e instanceof SfError) throw e;
      const err = e as Error;
      throw new SfError(sharedMessages.getMessage('SingleAccessFrontdoorError'), err.message);
    }
  } else {
    // TODO: remove this code path once the org open behavior changes on August 2025 (see W-17661469)
    const instanceUrlClean = org.getField<string>(Org.Fields.INSTANCE_URL).replace(/\/$/, '');
    return `${instanceUrlClean}/secur/frontdoor.jsp?sid=${accessToken}`;
  }
};

export const handleDomainError = (err: unknown, url: string, env: Env): string => {
  if (err instanceof Error) {
    if (err.message.includes('timeout')) {
      const host = /https?:\/\/([^.]*)/.exec(url)?.[1];
      if (!host) {
        throw new SfError('InvalidUrl', 'InvalidUrl');
      }
      const domain = `https://${host}.lightning.force.com`;
      const domainRetryTimeout = env.getNumber('SF_DOMAIN_RETRY') ?? env.getNumber('SFDX_DOMAIN_RETRY', 240);
      const timeout = new Duration(domainRetryTimeout, Duration.Unit.SECONDS);
      const logger = Logger.childFromRoot('org:open');
      logger.debug(`Did not find IP for ${domain} after ${timeout.seconds} seconds`);
      throw new SfError(messages.getMessage('domainTimeoutError'), 'domainTimeoutError');
    }
    throw SfError.wrap(err);
  }
  throw err;
};

/** builds the html file that does an automatic post to the frontdoor url */
export const getFileContents = (
  authToken: string,
  instanceUrl: string,
  // we have to defalt this to get to Setup only on the POST version.  GET goes to Setup automatically
  retUrl = '/lightning/setup/SetupOneHome/home'
): string => `
<html>
  <body onload="document.body.firstElementChild.submit()">
    <form method="POST" action="${instanceUrl}/secur/frontdoor.jsp">
      <input type="hidden" name="sid" value="${authToken}" />
      <input type="hidden" name="retURL" value="${retUrl}" />
    </form>
  </body>
</html>`;

export default {
  openUrl,
  fileCleanup,
  buildFrontdoorUrl,
  handleDomainError,
  getFileContents,
};
