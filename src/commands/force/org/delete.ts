/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags, SfCommand, orgApiVersionFlagWithDeprecations, loglevel } from '@salesforce/sf-plugins-core';
import { AuthInfo, AuthRemover, Messages, Org, StateAggregator } from '@salesforce/core';
import { SandboxAccessor } from '@salesforce/core/lib/stateAggregator/accessors/sandboxAccessor';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

export type DeleteResult = {
  orgId: string;
  username: string;
};

export class Delete extends SfCommand<DeleteResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static state = 'deprecated';
  public static deprecationOptions = {
    message: messages.getMessage('deprecation'),
  };
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
    targetdevhubusername: Flags.string({
      summary: messages.getMessage('flags.targetdevhubusername'),
      char: 'v',
      hidden: true,
      deprecated: {
        version: '58.0',
        message: messages.getMessage('flags.targetdevhubusername'),
      },
    }),
    'api-version': orgApiVersionFlagWithDeprecations,
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.noprompt'),
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
    loglevel,
  };

  public async run(): Promise<DeleteResult> {
    const { flags } = await this.parse(Delete);
    const resolvedUsername =
      // from -o alias -> -o username -> [default username]
      (await StateAggregator.getInstance()).aliases.getUsername(flags['target-org'] ?? '') ??
      flags['target-org'] ??
      (this.configAggregator.getPropertyValue('target-org') as string);

    if (!resolvedUsername) {
      throw messages.createError('missingUsername');
    }

    const isSandbox = (await SandboxAccessor.create({ username: resolvedUsername })).has(resolvedUsername);
    const orgId = (await AuthInfo.create({ username: resolvedUsername })).getFields().orgId as string;
    // read the config file for the org to be deleted, if it has a PROD_ORG_USERNAME entry, it's a sandbox
    // we either need permission to proceed without a prompt OR get the user to confirm
    if (
      flags['no-prompt'] ||
      (await this.confirm(messages.getMessage('confirmDelete', [isSandbox ? 'sandbox' : 'scratch', resolvedUsername])))
    ) {
      let alreadyDeleted = false;
      let successMessageKey = 'commandSandboxSuccess';
      try {
        const org = await Org.create({ aliasOrUsername: resolvedUsername });

        // will determine if it's a scratch org or sandbox and will delete from the appropriate parent org (DevHub or Production)
        await org.delete();
      } catch (e) {
        if (e instanceof Error && e.name === 'DomainNotFoundError') {
          // the org has expired, so remote operations won't work
          // let's clean up the files locally
          const authRemover = await AuthRemover.create();
          await authRemover.removeAuth(resolvedUsername);
        } else if (e instanceof Error && e.name === 'ScratchOrgNotFound') {
          alreadyDeleted = true;
        } else if (e instanceof Error && e.name === 'SandboxNotFound') {
          successMessageKey = 'sandboxConfigOnlySuccess';
        } else {
          throw e;
        }
      }

      this.log(
        isSandbox
          ? messages.getMessage(successMessageKey, [resolvedUsername])
          : messages.getMessage(alreadyDeleted ? 'deleteOrgConfigOnlyCommandSuccess' : 'deleteOrgCommandSuccess', [
              resolvedUsername,
            ])
      );
    }
    return { username: resolvedUsername, orgId };
  }
}
