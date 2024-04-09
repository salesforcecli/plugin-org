/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { platform, tmpdir } from 'node:os';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import {
  Flags,
  loglevel,
  orgApiVersionFlagWithDeprecations,
  requiredOrgFlagWithDeprecations,
  SfCommand,
} from '@salesforce/sf-plugins-core';
import isWsl from 'is-wsl';
import { Connection, Logger, Messages, Org, SfdcUrl, SfError } from '@salesforce/core';
import { Duration, Env, sleep } from '@salesforce/kit';
import { MetadataResolver } from '@salesforce/source-deploy-retrieve';
import { apps } from 'open';
import utils from '../../shared/utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');

export class OrgOpenCommand extends SfCommand<OrgOpenOutput> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:org:open', 'force:source:open'];
  public static deprecateAliases = true;

  public static readonly flags = {
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': orgApiVersionFlagWithDeprecations,
    private: Flags.boolean({
      summary: messages.getMessage('flags.private.summary'),
      exclusive: ['url-only', 'browser'],
    }),
    browser: Flags.option({
      char: 'b',
      summary: messages.getMessage('flags.browser.summary'),
      options: ['chrome', 'edge', 'firefox'] as const, // These are ones supported by "open" package
      exclusive: ['url-only', 'private'],
    })(),
    path: Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.path.summary'),
      env: 'FORCE_OPEN_URL',
      exclusive: ['source-file'],
      parse: (input: string): Promise<string> => Promise.resolve(encodeURIComponent(decodeURIComponent(input))),
    }),
    'url-only': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.url-only.summary'),
      aliases: ['urlonly'],
      deprecateAliases: true,
    }),
    loglevel,
    'source-file': Flags.file({
      char: 'f',
      aliases: ['sourcefile'],
      exclusive: ['path'],
      deprecateAliases: true,
      summary: messages.getMessage('flags.source-file.summary'),
    }),
  };

  public async run(): Promise<OrgOpenOutput> {
    const { flags } = await this.parse(OrgOpenCommand);
    const conn = flags['target-org'].getConnection(flags['api-version']);

    const env = new Env();
    const [frontDoorUrl, retUrl] = await Promise.all([
      buildFrontdoorUrl(flags['target-org'], conn),
      flags['source-file'] ? generateFileUrl(flags['source-file'], conn) : flags.path,
    ]);

    const url = `${frontDoorUrl}${retUrl ? `&retURL=${retUrl}` : ''}`;

    const orgId = flags['target-org'].getOrgId();
    // TODO: better typings in sfdx-core for orgs read from auth files
    const username = flags['target-org'].getUsername() as string;
    const output = { orgId, url, username };
    // NOTE: Deliberate use of `||` here since getBoolean() defaults to false, and we need to consider both env vars.
    const containerMode = env.getBoolean('SF_CONTAINER_MODE') || env.getBoolean('SFDX_CONTAINER_MODE');

    // security warning only for --json OR --url-only OR containerMode
    if (flags['url-only'] || Boolean(flags.json) || containerMode) {
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
      if (err instanceof Error) {
        if (err.message.includes('timeout')) {
          const domain = `https://${/https?:\/\/([^.]*)/.exec(url)?.[1]}.lightning.force.com`;
          const domainRetryTimeout = env.getNumber('SF_DOMAIN_RETRY') ?? env.getNumber('SFDX_DOMAIN_RETRY', 240);
          const timeout = new Duration(domainRetryTimeout, Duration.Unit.SECONDS);
          const logger = await Logger.child(this.constructor.name);
          logger.debug(`Did not find IP for ${domain} after ${timeout.seconds} seconds`);
          throw new SfError(messages.getMessage('domainTimeoutError'), 'domainTimeoutError');
        }
        throw SfError.wrap(err);
      }
      throw err;
    }

    // create a local html file that contains the POST stuff.
    const tempFilePath = path.join(tmpdir(), `org-open-${new Date().valueOf()}.html`);
    await fs.promises.writeFile(
      tempFilePath,
      getFileContents(
        conn.accessToken as string,
        conn.instanceUrl,
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

    return output;
  }
}

export type OrgOpenOutput = {
  url: string;
  username: string;
  orgId: string;
}

const fileCleanup = (tempFilePath: string): void =>
  fs.rmSync(tempFilePath, { force: true, maxRetries: 3, recursive: true });

const buildFrontdoorUrl = async (org: Org, conn: Connection): Promise<string> => {
  await org.refreshAuth(); // we need a live accessToken for the frontdoor url
  const accessToken = conn.accessToken;
  const instanceUrl = org.getField<string>(Org.Fields.INSTANCE_URL);
  const instanceUrlClean = instanceUrl.replace(/\/$/, '');
  return `${instanceUrlClean}/secur/frontdoor.jsp?sid=${accessToken}`;
};

const generateFileUrl = async (file: string, conn: Connection): Promise<string> => {
  try {
    const metadataResolver = new MetadataResolver();
    const components = metadataResolver.getComponentsFromPath(file);
    const typeName = components[0]?.type?.name;

    switch (typeName) {
      case 'ApexPage':
        return `/apex/${path.basename(file).replace('.page-meta.xml', '').replace('.page', '')}`;
      case 'Flow':
        return `/builder_platform_interaction/flowBuilder.app?flowId=${await flowFileNameToId(conn, file)}`;
      case 'FlexiPage':
        return `/visualEditor/appBuilder.app?pageId=${await flexiPageFilenameToId(conn, file)}`;
      default:
        return 'lightning/setup/FlexiPageList/home';
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'FlowIdNotFoundError') {
      throw error;
    }
    return 'lightning/setup/FlexiPageList/home';
  }
};

/** query flexipage via toolingPAI to get its ID (starts with 0M0) */
const flexiPageFilenameToId = async (conn: Connection, filePath: string): Promise<string> =>
  (
    await conn.singleRecordQuery<{ Id: string }>(
      `SELECT id FROM flexipage WHERE DeveloperName='${path.basename(filePath, '.flexipage-meta.xml')}'`,
      { tooling: true }
    )
  ).Id;

/** query the rest API to turn a flow's filepath into a FlowId  (starts with 301) */
const flowFileNameToId = async (conn: Connection, filePath: string): Promise<string> => {
  try {
    const flow = await conn.singleRecordQuery<{ DurableId: string }>(
      `SELECT DurableId FROM FlowVersionView WHERE FlowDefinitionView.ApiName = '${path.basename(
        filePath,
        '.flow-meta.xml'
      )}' ORDER BY VersionNumber DESC LIMIT 1`
    );
    return flow.DurableId;
  } catch (error) {
    throw messages.createError('FlowIdNotFound', [filePath]);
  }
};

/** builds the html file that does an automatic post to the frontdoor url */
const getFileContents = (
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
