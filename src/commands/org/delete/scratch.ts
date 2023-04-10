/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, AuthRemover, Messages, Org, StateAggregator } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete_scratch');

export interface ScratchDeleteResponse {
  orgId: string;
  username: string;
}

export default class EnvDeleteScratch extends SfCommand<ScratchDeleteResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['env:delete:scratch'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    'target-org': Flags.string({
      // not required because the user could be assuming the default config
      aliases: ['targetusername', 'u'],
      deprecateAliases: true,
      // we're recreating the flag without all the validation
      // eslint-disable-next-line sf-plugin/dash-o
      char: 'o',
      summary: messages.getMessage('flags.target-org.summary'),
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.no-prompt.summary'),
    }),
  };

  public async run(): Promise<ScratchDeleteResponse> {
    const flags = (await this.parse(EnvDeleteScratch)).flags;
    const resolvedUsername =
      // from -o alias -> -o username -> [default username]
      (await StateAggregator.getInstance()).aliases.getUsername(flags['target-org'] ?? '') ??
      flags['target-org'] ??
      (this.configAggregator.getPropertyValue('target-org') as string);
    const orgId = (await AuthInfo.create({ username: resolvedUsername })).getFields().orgId as string;

    if (flags['no-prompt'] || (await this.confirm(messages.getMessage('prompt.confirm', [resolvedUsername])))) {
      try {
        const org = await Org.create({ aliasOrUsername: resolvedUsername });

        await org.delete();
        this.logSuccess(messages.getMessage('success', [org.getUsername()]));
        return { username: org.getUsername() as string, orgId: org.getOrgId() };
      } catch (e) {
        if (e instanceof Error && e.name === 'DomainNotFoundError') {
          // the org has expired, so remote operations won't work
          // let's clean up the files locally
          // but first read the orgId from the auth file
          const authRemover = await AuthRemover.create();
          await authRemover.removeAuth(resolvedUsername);
          this.logSuccess(messages.getMessage('success', [resolvedUsername]));
        } else if (e instanceof Error && e.name === 'ScratchOrgNotFound') {
          this.logSuccess(messages.getMessage('success.Idempotent', [resolvedUsername]));
        } else {
          throw e;
        }
      }
    }
    return { username: resolvedUsername, orgId };
  }
}
