/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages('@salesforce/plugin-org', 'org.enable.tracking');

export type OrgEnableTrackingResult = {
  tracksSource: boolean;
  username: string;
};

export default class OrgEnableTracking extends SfCommand<OrgEnableTrackingResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
  };

  public async run(): Promise<OrgEnableTrackingResult> {
    const { flags } = await this.parse(OrgEnableTracking);

    // can this org do tracking?
    if (!(await flags['target-org'].supportsSourceTracking())) {
      throw messages.createError('error.TrackingNotAvailable');
    }

    await flags['target-org'].setTracksSource(true);
    this.logSuccess(messages.getMessage('success', [flags['target-org'].getUsername()]));
    return {
      tracksSource: await flags['target-org'].tracksSource(),
      username: flags['target-org'].getUsername() as string,
    };
  }
}
