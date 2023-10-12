/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
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
import open = require('open');
import { openUrl } from '../../shared/utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');

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

    if (flags['source-file']) {
      url += `&retURL=${await this.generateFileUrl(flags['source-file'])}`;
    } else if (flags.path) {
      url += `&retURL=${flags.path}`;
    }

    const orgId = this.org.getOrgId();
    // TODO: better typings in sfdx-core for orgs read from auth files
    const username = this.org.getUsername() as string;
    const output = { orgId, url, username };
    const containerMode = new Env().getBoolean('SFDX_CONTAINER_MODE');

    // security warning only for --json OR --url-only OR containerMode
    if (flags['url-only'] || flags.json || containerMode) {
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
          const timeout = new Duration(new Env().getNumber('SFDX_DOMAIN_RETRY', 240), Duration.Unit.SECONDS);
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
        { app: { name: open.apps[flags.browser as 'chrome' | 'edge' | 'firefox'] } }
      : {};

    await openUrl(url, openOptions);
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

/** query the tooling API to turn a flow's filepath into a FlowId  (starts with 301) */
const flowFileNameToId = async (conn: Connection, filePath: string): Promise<string> => {
  const result = await conn.tooling.query<{ Id: string; FullName: string }>(
    'select id, MasterLabel, FullName from Flow'
  );
  const fullName = path.basename(filePath).replace('.flow-meta.xml', '');
  // https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_flow.htm
  // unfortunately, you can't query based on the fullname because `field 'FullName' can not be filtered in a query call`
  // so we get all the flows and then filter.
  const match = (result.records ?? []).find((r) => r.FullName === fullName)?.Id;
  if (match) {
    return match;
  }
  throw messages.createError('FlowIdNotFound', [filePath]);
};
