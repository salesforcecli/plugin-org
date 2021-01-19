/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export interface OrgDisplayReturn extends Partial<ScratchOrgFields> {
  username: string;
  id: string;
  accessToken: string;
  instanceUrl: string;
  clientId: string;

  alias?: string;
  password?: string;

  // non-scratch orgs
  connectedStatus?: string;
  sfdxAuthUrl?: string;
}

// developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_scratchorginfo.htm
export interface ScratchOrgInfoSObject {
  Id: string;
  CreatedDate: string;
  Status: 'New' | 'Deleted' | 'Active' | 'Error';
  ExpirationDate: string;
  CreatedBy: {
    Username: string;
  };
  Edition: string;
  Namespace?: string;
  OrgName?: string;
  SignupUsername: string;
}

export interface ScratchOrgFields {
  createdBy: string;
  createdDate: string;
  expirationDate: string;
  orgName: string;
  status: string;
  devHubId?: string;
  edition?: string;
  namespace?: string;
  snapshot?: string;
}

export interface OrgListFields {
  isDefaultUsername?: boolean;
  isDefaultDevHubUsername?: boolean;
}
