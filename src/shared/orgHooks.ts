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

import type { AuthFields } from '@salesforce/core';
import { Command, Interfaces, Hook } from '@oclif/core';

type HookOpts<T> = {
  options: { Command: Command.Class; argv: string[]; commandId: string };
  return: T | undefined;
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
export type OrgHooks = {
  postorgcreate: PostOrgCreateOpts;
} & Interfaces.Hooks;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OrgHook<T> = (this: Hook.Context, options: T extends keyof Interfaces.Hooks ? OrgHooks[T] : T) => any;

// eslint-disable-next-line no-redeclare
export declare namespace OrgHook {
  // TODO get rid of the ts-ignore
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  export type PostOrgCreate = Hook<OrgHooks['postorgcreate']>;
}
