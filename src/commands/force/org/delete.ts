/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'delete');

type DeleteResult = {
  orgId: string;
  username: string;
};

export class Delete extends SfdxCommand {
  public static readonly requiresUsername = true;
  public static readonly supportsDevhubUsername = true;
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('flags.noprompt'),
    }),
  };

  public async run(): Promise<DeleteResult> {
    const username = this.org.getUsername();
    const orgId = this.org.getOrgId();
    const isSandbox = await this.org.isSandbox();
    // read the config file for the org to be deleted, if it has a PROD_ORG_USERNAME entry, it's a sandbox
    // we either need permission to proceed without a prompt OR get the user to confirm
    if (
      this.flags.noprompt ||
      (await this.ux.confirm(messages.getMessage('confirmDelete', [isSandbox ? 'sandbox' : 'scratch', username])))
    ) {
      let alreadyDeleted = false;
      let successMessageKey = 'commandSandboxSuccess';
      try {
        // will determine if it's a scratch org or sandbox and will delete from the appropriate parent org (DevHub or Production)
        await this.org.delete();
      } catch (e) {
        if (e instanceof Error && e.name === 'ScratchOrgNotFound') {
          alreadyDeleted = true;
        } else if (e instanceof Error && e.name === 'SandboxNotFound') {
          successMessageKey = 'sandboxConfigOnlySuccess';
        } else {
          throw e;
        }
      }

      this.ux.log(
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
