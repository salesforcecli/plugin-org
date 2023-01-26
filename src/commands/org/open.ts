/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
  orgApiVersionFlagWithDeprecations,
  loglevel,
} from '@salesforce/sf-plugins-core';
import { Logger, Messages, Org, SfdcUrl, SfError } from '@salesforce/core';
import { Duration, Env } from '@salesforce/kit';
import open = require('open');
import { openUrl } from '../../shared/utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');

export class OrgOpenCommand extends SfCommand<OrgOpenOutput> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:org:open'];
  public static depreprecateAliases = true;

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
      parse: (input: string): Promise<string> => Promise.resolve(encodeURIComponent(decodeURIComponent(input))),
    }),
    'url-only': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.url-only.summary'),
      aliases: ['urlonly'],
      deprecateAliases: true,
    }),
    loglevel,
  };

  private org!: Org;
  public async run(): Promise<OrgOpenOutput> {
    const { flags } = await this.parse(OrgOpenCommand);
    this.org = flags['target-org'];
    const frontDoorUrl = await this.buildFrontdoorUrl(flags['api-version']);
    const url = flags.path ? `${frontDoorUrl}&retURL=${flags.path}` : frontDoorUrl;
    const orgId = this.org.getOrgId();
    // TODO: better typings in sfdx-core for orgs read from auth files
    const username = this.org.getUsername() as string;
    const output = { orgId, url, username };
    const containerMode = new Env().getBoolean('SFDX_CONTAINER_MODE');

    // security warning only for --json OR --urlonly OR containerMode
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

  private async buildFrontdoorUrl(version?: string): Promise<string> {
    await this.org.refreshAuth(); // we need a live accessToken for the frontdoor url
    const conn = this.org.getConnection(version);
    const accessToken = conn.accessToken;
    const instanceUrl = this.org.getField<string>(Org.Fields.INSTANCE_URL);
    const instanceUrlClean = instanceUrl.replace(/\/$/, '');
    return `${instanceUrlClean}/secur/frontdoor.jsp?sid=${accessToken}`;
  }
}

export interface OrgOpenOutput {
  url: string;
  username: string;
  orgId: string;
}
