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

import { ChildProcess, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import open, { apps, Options } from 'open';
import { Logger, Messages, SfError } from '@salesforce/core';
import { Duration, Env } from '@salesforce/kit';

const execFileAsync = promisify(execFile);

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');

export const openUrl = async (url: string, options: Options): Promise<ChildProcess> => open(url, options);

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

const windowsBrowserProgIds: Record<string, { name: string; id: string }> = {
  MSEdgeHTM: { name: 'Edge', id: 'com.microsoft.edge' },
  MSEdgeBHTML: { name: 'Edge Beta', id: 'com.microsoft.edge.beta' },
  ChromeHTML: { name: 'Chrome', id: 'com.google.chrome' },
  ChromeBHTML: { name: 'Chrome Beta', id: 'com.google.chrome.beta' },
  BraveHTML: { name: 'Brave', id: 'com.brave.Browser' },
  FirefoxURL: { name: 'Firefox', id: 'org.mozilla.firefox' },
};

const browserIdToAppName: Record<string, 'chrome' | 'firefox' | 'edge' | 'brave'> = {
  'com.google.chrome': 'chrome',
  'com.google.chrome.beta': 'chrome',
  'com.brave.Browser': 'brave',
  'org.mozilla.firefox': 'firefox',
  'com.microsoft.edge': 'edge',
  'com.microsoft.edge.beta': 'edge',
};

const privateFlags: Record<string, string> = {
  chrome: '--incognito',
  brave: '--incognito',
  firefox: '--private-window',
  edge: '--inPrivate',
};

export type ExecFileFn = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

export async function getWindowsPrivateBrowserApp(
  _execFile: ExecFileFn = execFileAsync
): Promise<{ name: string | readonly string[]; arguments: string[] }> {
  const regPath = `${process.env.SYSTEMROOT ?? process.env.windir ?? 'C:\\Windows'}\\System32\\reg.exe`;
  const { stdout } = await _execFile(regPath, [
    'QUERY',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice',
    '/v',
    'ProgId',
  ]);

  const match = /ProgId\s*REG_SZ\s*(?<id>\S+)/.exec(stdout);
  if (!match?.groups?.id) {
    throw new SfError('Unable to detect default browser from Windows registry');
  }

  const { id } = match.groups;
  const hyphenIndex = id.lastIndexOf('-');
  const baseId = hyphenIndex === -1 ? undefined : id.slice(0, hyphenIndex);

  const browser = windowsBrowserProgIds[id] ?? (baseId ? windowsBrowserProgIds[baseId] : undefined);
  if (!browser) {
    throw new SfError(`Unsupported default browser: ${id}`);
  }

  const appName = browserIdToAppName[browser.id];
  if (!appName) {
    throw new SfError(`Unsupported default browser: ${browser.name}`);
  }

  return { name: apps[appName], arguments: [privateFlags[appName]] };
}

export default {
  openUrl,
  handleDomainError,
};
