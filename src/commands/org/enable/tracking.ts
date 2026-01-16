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

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
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
