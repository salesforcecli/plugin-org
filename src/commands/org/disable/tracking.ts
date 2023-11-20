/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(dirname(fileURLToPath(import.meta.url)));
const messages = Messages.loadMessages('@salesforce/plugin-org', 'org.disable.tracking');

export type OrgDisableTrackingResult = {
  tracksSource: boolean;
  username: string;
};

export default class OrgDisableTracking extends SfCommand<OrgDisableTrackingResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
  };

  public async run(): Promise<OrgDisableTrackingResult> {
    const { flags } = await this.parse(OrgDisableTracking);
    await flags['target-org'].setTracksSource(false);
    this.logSuccess(messages.getMessage('success', [flags['target-org'].getUsername()]));
    return {
      tracksSource: await flags['target-org'].tracksSource(),
      username: flags['target-org'].getUsername() as string,
    };
  }
}
