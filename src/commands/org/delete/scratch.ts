/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, AuthRemover, Messages, Org } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { orgThatMightBeDeleted } from '../../../shared/flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete_scratch');

export interface ScratchDeleteResponse {
  orgId: string;
  username: string;
}

export default class DeleteScratch extends SfCommand<ScratchDeleteResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['env:delete:scratch'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    'target-org': orgThatMightBeDeleted({
      summary: messages.getMessage('flags.target-org.summary'),
      required: true,
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.no-prompt.summary'),
    }),
  };

  public async run(): Promise<ScratchDeleteResponse> {
    const flags = (await this.parse(DeleteScratch)).flags;
    const resolvedUsername = flags['target-org'];
    const orgId = (await AuthInfo.create({ username: resolvedUsername })).getFields().orgId as string;

    if (
      flags['no-prompt'] ||
      (await this.confirm({ message: messages.getMessage('prompt.confirm', [resolvedUsername]) }))
    ) {
      try {
        const org = await Org.create({ aliasOrUsername: resolvedUsername });

        await org.delete();
        this.logSuccess(messages.getMessage('success', [org.getUsername()]));
        return { username: org.getUsername() as string, orgId: org.getOrgId() };
      } catch (e) {
        if (e instanceof Error && e.name === 'DomainNotFoundError') {
          // the org has expired, so remote operations won't work
          // let's clean up the files locally
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
