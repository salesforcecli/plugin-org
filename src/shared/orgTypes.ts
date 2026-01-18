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

import { AuthFields, ScratchOrgInfo } from '@salesforce/core';

export type OrgDisplayReturn = Partial<ScratchOrgFields> & {
  username: string;
  id: string;
  accessToken: string;
  instanceUrl: string;
  clientId: string;
  apiVersion?: string;

  alias?: string;
  password?: string;

  // non-scratch orgs
  connectedStatus?: string;
  sfdxAuthUrl?: string;
  clientApps?: string;
};

export type OrgOpenOutput = {
  url: string;
  username: string;
  orgId: string;
};

/** Convenience type for the fields that are in the auth file
 *
 * core's AuthFields has everything as optional.
 *
 * In this case, we have a username because these come from auth files */
export type AuthFieldsFromFS = Omit<AuthFields, 'expirationDate'> & {
  username: string;
  orgId: string;
  accessToken: string;
  instanceUrl: string;
  clientId: string;
  string: string;
};

export type ExtendedAuthFields = AuthFieldsFromFS & OrgListFields;

export type ExtendedAuthFieldsScratch = ExtendedAuthFields & {
  expirationDate: string;
  devHubUsername: string;
  devHubOrgId?: string;
};

export type FullyPopulatedScratchOrgFields = ScratchOrgFields &
  ExtendedAuthFieldsScratch & {
    isExpired: boolean;
  };

// developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_scratchorginfo.htm
export type ScratchOrgInfoSObject = {
  CreatedDate: string;
  Status: 'New' | 'Deleted' | 'Active' | 'Error';
  ExpirationDate: string;
  CreatedBy: {
    Username: string;
  };
  Edition: string;
  Namespace?: string;
  OrgName: string;
  SignupUsername: string;
  LoginUrl: string;
};

/** fields in the  */
export type ScratchOrgFields = {
  createdBy: string;
  createdDate: string;
  expirationDate: string;
  orgName: string;
  status: string;
  devHubId: string;
  edition?: string;
  namespace?: string;
  snapshot?: string;
  lastUsed?: Date;
  signupUsername: string;
};

export type OrgListFields = {
  connectedStatus?: string;
  isDefaultUsername?: boolean;
  isDefaultDevHubUsername?: boolean;
  defaultMarker?: '(D)' | '(U)';
  attributes?: Record<string, unknown>;
  lastUsed?: Date;
};

/** If the scratch org is resumed, but doesn't get very far in the process, it won't have much information on it */
export type ScratchCreateResponse = {
  username?: string;
  scratchOrgInfo?: ScratchOrgInfo;
  authFields?: AuthFields;
  warnings: string[];
  orgId?: string;
};

export enum SandboxLicenseType {
  developer = 'Developer',
  developerPro = 'Developer_Pro',
  partial = 'Partial',
  full = 'Full',
}
