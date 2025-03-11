/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChildProcess } from 'node:child_process';
import open, { Options } from 'open';
import { Connection, Logger, Messages, Org, SfError } from '@salesforce/core';
import { Duration, Env } from '@salesforce/kit';
import { JsonMap } from '@salesforce/ts-types';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');

export const openUrl = async (url: string, options: Options): Promise<ChildProcess> => open(url, options);

/**
 * This method generates and returns a single-use frontdoor url for the given org.
 *
 * @param org org for which we generate the frontdoor url.
 * @param conn the Connection for the given Org.
 */
export const buildFrontdoorUrl = async (org: Org, conn: Connection): Promise<string> => {
  await org.refreshAuth(); // we need a live accessToken for the frontdoor url
  if (!conn.accessToken) {
    throw new SfError('NoAccessToken', 'NoAccessToken');
  }
  const response: JsonMap = await conn.requestGet('/services/oauth2/singleaccess');
  return response.frontdoor_uri as string;
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

export default {
  openUrl,
  buildFrontdoorUrl,
  handleDomainError,
};
