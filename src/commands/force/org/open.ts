/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';
import { URL } from 'url';

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, Org, MyDomainResolver, SfdxError, sfdc } from '@salesforce/core';
import { Env, Duration } from '@salesforce/kit';
import { createOpenOptions, openUrl } from '../../../shared/utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');
export class OrgOpenCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(EOL);
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    browser: flags.string({
      char: 'b',
      description: messages.getMessage('browser'),
    }),
    path: flags.string({
      char: 'p',
      description: messages.getMessage('cliPath'),
      env: 'FORCE_OPEN_URL',
      parse: (input) => encodeURIComponent(decodeURIComponent(input)),
    }),
    urlonly: flags.boolean({
      char: 'r',
      description: messages.getMessage('urlonly'),
    }),
  };

  public async run(): Promise<OrgOpenOutput> {
    const frontDoorUrl = await this.buildFrontdoorUrl();
    const url = this.flags.path ? `${frontDoorUrl}&retURL=${this.flags.path as string}` : frontDoorUrl;
    const orgId = this.org.getOrgId();
    const username = this.org.getUsername();
    const output = { orgId, url, username };

    if (new Env().getBoolean('SFDX_CONTAINER_MODE')) {
      // instruct the user that they need to paste the URL into the browser
      this.ux.styledHeader('Action Required!');
      this.ux.log(messages.getMessage('containerAction', [orgId, url]));
      return output;
    }

    this.ux.log(messages.getMessage('humanSuccess', [orgId, username, url]));

    if (this.flags.urlonly) {
      return output;
    }

    const openOptions = this.flags.browser ? createOpenOptions(this.flags.browser) : {};
    if (!openOptions) {
      this.ux.error(messages.getMessage('UnsupportedBrowserError'));
      return output;
    }

    // we actually need to open the org
    await this.checkLightningDomain(url);
    await openUrl(url, openOptions);
    return output;
  }

  private async buildFrontdoorUrl(): Promise<string> {
    await this.org.refreshAuth(); // we need a live accessToken for the frontdoor url
    const conn = this.org.getConnection();
    const accessToken = conn.accessToken;
    const instanceUrl = this.org.getField(Org.Fields.INSTANCE_URL) as string;
    const instanceUrlClean = instanceUrl.replace(/\/$/, '');
    return `${instanceUrlClean}/secur/frontdoor.jsp?sid=${accessToken}`;
  }

  private async checkLightningDomain(url: string): Promise<void> {
    const domain = `https://${/https?:\/\/([^.]*)/.exec(url)[1]}.lightning.force.com`;
    const timeout = new Duration(new Env().getNumber('SFDX_DOMAIN_RETRY', 240), Duration.Unit.SECONDS);
    if (sfdc.isInternalUrl(url) || timeout.seconds === 0) {
      return;
    }

    const resolver = await MyDomainResolver.create({
      url: new URL(domain),
      timeout,
      frequency: new Duration(1, Duration.Unit.SECONDS),
    });
    this.ux.startSpinner(messages.getMessage('domainWaiting'));

    try {
      const ip = await resolver.resolve();
      this.logger.debug(`Found IP ${ip} for ${domain}`);
      return;
    } catch (error) {
      this.logger.debug(`Did not find IP for ${domain} after ${timeout.seconds} seconds`);
      throw new SfdxError(messages.getMessage('domainTimeoutError'), 'domainTimeoutError', [
        messages.getMessage('domainTimeoutAction'),
      ]);
    }
  }
}

interface OrgOpenOutput {
  url: string;
  username: string;
  orgId: string;
}
