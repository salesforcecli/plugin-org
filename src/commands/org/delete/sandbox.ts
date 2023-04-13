/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, AuthRemover, Messages, Org, SfError, StateAggregator } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete_sandbox');

export interface SandboxDeleteResponse {
  orgId: string;
  username: string;
}

export default class EnvDeleteSandbox extends SfCommand<SandboxDeleteResponse> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['env:delete:sandbox'];
  public static readonly deprecateAliases = true;
  public static readonly flags = {
    'target-org': Flags.string({
      // we're recreating the flag without all the validation
      // eslint-disable-next-line sf-plugin/dash-o
      char: 'o',
      summary: messages.getMessage('flags.target-org.summary'),
      required: true,
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.no-prompt.summary'),
    }),
  };

  public async run(): Promise<SandboxDeleteResponse> {
    const flags = (await this.parse(EnvDeleteSandbox)).flags;
    const username =
      // from -o alias -> -o username -> [default username resolved an alias] -> [default username]
      (await StateAggregator.getInstance()).aliases.getUsername(flags['target-org'] ?? '') ??
      flags['target-org'] ??
      (await StateAggregator.getInstance()).aliases.getUsername(
        this.configAggregator.getPropertyValue('target-org') as string
      ) ??
      (this.configAggregator.getPropertyValue('target-org') as string);
    if (!username) {
      throw new SfError('The org does not have a username.');
    }

    const orgId = (await AuthInfo.create({ username })).getFields().orgId as string;
    const isSandbox = await (await StateAggregator.getInstance()).sandboxes.hasFile(orgId);

    if (!isSandbox) {
      throw messages.createError('error.isNotSandbox', [username]);
    }

    if (flags['no-prompt'] || (await this.confirm(messages.getMessage('prompt.confirm', [username])))) {
      try {
        const org = await Org.create({ aliasOrUsername: username });
        await org.delete();
        this.logSuccess(messages.getMessage('success', [username]));
      } catch (e) {
        if (e instanceof Error && e.name === 'DomainNotFoundError') {
          // the org has expired, so remote operations won't work
          // let's clean up the files locally
          const authRemover = await AuthRemover.create();
          await authRemover.removeAuth(username);
          this.logSuccess(messages.getMessage('success.Idempotent', [username]));
        } else if (e instanceof Error && e.name === 'SandboxNotFound') {
          this.logSuccess(messages.getMessage('success.Idempotent', [username]));
        } else {
          throw e;
        }
      }
    }
    return { username, orgId };
  }
}
