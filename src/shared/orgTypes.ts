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

export interface ScratchOrgInfoSObject {
  CreatedDate: string;
  Status: string;
  ExpirationDate: string;
  Owner: {
    Username: string;
  };
  Edition: string;
  Namespace?: string;
  OrgName?: string;
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
