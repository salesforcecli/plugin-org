/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Optional } from '@salesforce/ts-types';
import { AuthFields } from '@salesforce/core';
import { Command, Hook, Hooks } from '@oclif/core/lib/interfaces';

type HookOpts<T> = {
  options: { Command: Command.Class; argv: string[]; commandId: string };
  return: Optional<T>;
};

export type OrgCreateResult = Pick<
  AuthFields,
  | 'accessToken'
  | 'clientId'
  | 'created'
  | 'createdOrgInstance'
  | 'devHubUsername'
  | 'expirationDate'
  | 'instanceUrl'
  | 'loginUrl'
  | 'orgId'
  | 'username'
>;

type PostOrgCreateOpts = HookOpts<OrgCreateResult>;

/**
 * Extends OCLIF's Hooks interface to add types for hooks that run on org commands
 */
export interface OrgHooks extends Hooks {
  postorgcreate: PostOrgCreateOpts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OrgHook<T> = (this: Hook.Context, options: T extends keyof Hooks ? OrgHooks[T] : T) => any;

// eslint-disable-next-line no-redeclare
export declare namespace OrgHook {
  // TODO get rid of the ts-ignore
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  export type PostOrgCreate = Hook<OrgHooks['postorgcreate']>;
}
