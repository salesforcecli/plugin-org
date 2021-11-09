/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, Org } from '@salesforce/core';
import { SandboxOrgConfig } from '@salesforce/core/lib/config/sandboxOrgConfig';

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
  // because of requiresUsername
  public org!: Org;

  public async run(): Promise<DeleteResult> {
    const username = this.org.getUsername();
    const orgId = this.org.getOrgId();
    // read the config file for the org to be deleted, if it has a PROD_ORG_USERNAME entry, it's a sandbox
    const isSandbox = !!(await this.org.getSandboxOrgConfigField(SandboxOrgConfig.Fields.PROD_ORG_USERNAME));
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
        const err = e as Error;
        if (err.name === 'attemptingToDeleteExpiredOrDeleted') {
          alreadyDeleted = true;
        } else if (err.name === 'sandboxProcessNotFoundByOrgId') {
          successMessageKey = 'sandboxConfigOnlySuccess';
        } else {
          throw err;
        }
      }

      if (isSandbox) {
        this.ux.log(messages.getMessage(successMessageKey, [username]));
      } else {
        this.ux.log(
          messages.getMessage(alreadyDeleted ? 'deleteOrgConfigOnlyCommandSuccess' : 'deleteOrgCommandSuccess', [
            username,
          ])
        );
      }
    }
    return { username, orgId };
  }
}
