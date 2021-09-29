/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, Org, SfdcUrl, SfdxError } from '@salesforce/core';
import { Duration, Env } from '@salesforce/kit';
import { openUrl } from '../../../shared/utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');

export class OrgOpenCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(EOL);
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
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

    this.ux.warn(sharedMessages.getMessage('SecurityWarning'));
    this.ux.log('');

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
    // we actually need to open the org
    try {
      this.ux.startSpinner(messages.getMessage('domainWaiting'));
      const sfdcUrl = new SfdcUrl(url);
      await sfdcUrl.checkLightningDomain();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,  @typescript-eslint/no-unsafe-call
      if (err.message?.includes('timeout')) {
        const domain = `https://${/https?:\/\/([^.]*)/.exec(url)[1]}.lightning.force.com`;
        const timeout = new Duration(new Env().getNumber('SFDX_DOMAIN_RETRY', 240), Duration.Unit.SECONDS);
        this.logger.debug(`Did not find IP for ${domain} after ${timeout.seconds} seconds`);
        throw new SfdxError(messages.getMessage('domainTimeoutError'), 'domainTimeoutError', [
          messages.getMessage('domainTimeoutAction'),
        ]);
      }
      throw SfdxError.wrap(err);
    }
    await openUrl(url);
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
}

interface OrgOpenOutput {
  url: string;
  username: string;
  orgId: string;
}
