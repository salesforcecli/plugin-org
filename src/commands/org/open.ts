/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';

import {
  Flags,
  loglevel,
  orgApiVersionFlagWithDeprecations,
  requiredOrgFlagWithDeprecations,
  SfCommand,
} from '@salesforce/sf-plugins-core';
import { Connection, Logger, Messages, Org, SfdcUrl, SfError } from '@salesforce/core';
import { Duration, Env } from '@salesforce/kit';
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
    browser: Flags.string({
      char: 'b',
      summary: messages.getMessage('flags.browser.summary'),
      options: ['chrome', 'edge', 'firefox'], // These are ones supported by "open" package
      exclusive: ['url-only'],
    }),
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

  private org!: Org;
  private conn!: Connection;

  public async run(): Promise<OrgOpenOutput> {
    const { flags } = await this.parse(OrgOpenCommand);

    this.org = flags['target-org'];
    this.conn = this.org.getConnection(flags['api-version']);

    let url = await this.buildFrontdoorUrl();
    const env = new Env();

    if (flags['source-file']) {
      url += `&retURL=${await this.generateFileUrl(flags['source-file'])}`;
    } else if (flags.path) {
      url += `&retURL=${flags.path}`;
    }

    const orgId = this.org.getOrgId();
    // TODO: better typings in sfdx-core for orgs read from auth files
    const username = this.org.getUsername() as string;
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
      const sfdcUrl = new SfdcUrl(url);
      await sfdcUrl.checkLightningDomain();
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

    const openOptions = flags.browser
      ? // assertion can be removed once oclif option flag typings are fixed
        { app: { name: apps[flags.browser as 'chrome' | 'edge' | 'firefox'] } }
      : {};

    await utils.openUrl(url, openOptions);
    return output;
  }

  private async buildFrontdoorUrl(): Promise<string> {
    await this.org.refreshAuth(); // we need a live accessToken for the frontdoor url
    const accessToken = this.conn.accessToken;
    const instanceUrl = this.org.getField<string>(Org.Fields.INSTANCE_URL);
    const instanceUrlClean = instanceUrl.replace(/\/$/, '');
    return `${instanceUrlClean}/secur/frontdoor.jsp?sid=${accessToken}`;
  }

  private async generateFileUrl(file: string): Promise<string> {
    try {
      const metadataResolver = new MetadataResolver();
      const components = metadataResolver.getComponentsFromPath(file);
      const typeName = components[0]?.type?.name;

      if (typeName === 'FlexiPage') {
        const flexipage = await this.conn.singleRecordQuery<{ Id: string }>(
          `SELECT id FROM flexipage WHERE DeveloperName='${path.basename(file, '.flexipage-meta.xml')}'`,
          { tooling: true }
        );
        return `/visualEditor/appBuilder.app?pageId=${flexipage.Id}`;
      } else if (typeName === 'ApexPage') {
        return `/apex/${path.basename(file).replace('.page-meta.xml', '').replace('.page', '')}`;
      } else if (typeName === 'Flow') {
        return `/builder_platform_interaction/flowBuilder.app?flowId=${await flowFileNameToId(this.conn, file)}`;
      } else {
        return 'lightning/setup/FlexiPageList/home';
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'FlowIdNotFoundError') {
        this.error(error);
      }
      return 'lightning/setup/FlexiPageList/home';
    }
  }
}

export interface OrgOpenOutput {
  url: string;
  username: string;
  orgId: string;
}

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
