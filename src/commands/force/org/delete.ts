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
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

type DeleteResult = {
  orgId: string;
  username: string;
};

export class Delete extends SfCommand<DeleteResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': orgApiVersionFlagWithDeprecations,
    noprompt: Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.noprompt'),
    }),
    loglevel,
  };

  public async run(): Promise<DeleteResult> {
    const { flags } = await this.parse(Delete);
    const username = flags['target-org'].getUsername() ?? 'unknown username';
    const orgId = flags['target-org'].getOrgId();
    // the connection version can be set before using it to isSandbox and delete
    flags['target-org'].getConnection(flags['api-version']);
    const isSandbox = await flags['target-org'].isSandbox();
    // read the config file for the org to be deleted, if it has a PROD_ORG_USERNAME entry, it's a sandbox
    // we either need permission to proceed without a prompt OR get the user to confirm
    if (
      flags.noprompt ||
      (await this.confirm(messages.getMessage('confirmDelete', [isSandbox ? 'sandbox' : 'scratch', username])))
    ) {
      let alreadyDeleted = false;
      let successMessageKey = 'commandSandboxSuccess';
      try {
        // will determine if it's a scratch org or sandbox and will delete from the appropriate parent org (DevHub or Production)
        await flags['target-org'].delete();
      } catch (e) {
        if (e instanceof Error && e.name === 'ScratchOrgNotFound') {
          alreadyDeleted = true;
        } else if (e instanceof Error && e.name === 'SandboxNotFound') {
          successMessageKey = 'sandboxConfigOnlySuccess';
        } else {
          throw e;
        }
      }

      this.log(
        isSandbox
          ? messages.getMessage(successMessageKey, [username])
          : messages.getMessage(alreadyDeleted ? 'deleteOrgConfigOnlyCommandSuccess' : 'deleteOrgCommandSuccess', [
              username,
            ])
      );
    }
    return { username, orgId };
  }
}
