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
    const isSandbox = !!(await this.org.getSandboxOrgConfigField(SandboxOrgConfig.Fields.PROD_ORG_USERNAME));
    const orgType = isSandbox ? 'sandbox' : 'scratch';
    // we either need permission to proceed without a prompt OR get the user to confirm
    if (
      this.flags.noprompt ||
      (await this.ux.confirm(messages.getMessage('confirmDelete', [orgType, this.org.getUsername()])))
    ) {
      return isSandbox ? this.deleteSandbox() : this.deleteScratchOrg();
    }
  }

  private async deleteSandbox(): Promise<DeleteResult> {
    let successMessageKey = 'commandSandboxSuccess';
    const result = { orgId: this.org.getOrgId(), username: this.org.getUsername() };
    this.logger.debug('Delete started for sandbox org %s ', this.org.getUsername());
    try {
      await this.org.deleteSandbox(this.org.getOrgId());
      this.logger.debug('Sandbox org %s successfully marked for deletion', this.org.getUsername());
    } catch (e) {
      const err = e as Error;
      if (err.name === 'sandboxProcessNotFoundByOrgId') {
        successMessageKey = 'sandboxConfigOnlySuccess';
      } else {
        throw err;
      }
    }
    this.logger.debug('Sandbox org config %s has been successfully deleted', this.org.getUsername());
    this.ux.log(messages.getMessage(successMessageKey, [this.org.getUsername()]));
    return result;
  }

  private async deleteScratchOrg(): Promise<DeleteResult> {
    let alreadyDeleted = false;
    try {
      await this.org.deleteScratchOrg(this.hubOrg);
    } catch (e) {
      const err = e as Error;
      if (err.name === 'attemptingToDeleteExpiredOrDeleted') {
        alreadyDeleted = true;
      } else {
        // Includes the "insufficientAccessToDelete" error.
        throw err;
      }
    }

    this.ux.log(
      messages.getMessage(alreadyDeleted ? 'deleteOrgConfigOnlyCommandSuccess' : 'deleteOrgCommandSuccess', [
        this.org.getUsername(),
      ])
    );

    return {
      orgId: this.org.getOrgId(),
      username: this.org.getUsername(),
    };
  }
}
