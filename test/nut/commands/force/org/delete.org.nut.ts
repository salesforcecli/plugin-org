/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { AnyJson, getString, isArray } from '@salesforce/ts-types';
import { expect } from '@salesforce/command/lib/test';
// these NUTs are separated from org.nuts.ts because deleting orgs may interfere with the other NUTs
describe('Delete Orgs', () => {
  let session: TestSession;
  let defaultUsername: string;
  let aliasedUsername: string;
  let defaultUserOrgId: string;
  let aliasUserOrgId: string;

  // create our own orgs to delete to avoid interfering with other NUTs/cleanup
  before(async () => {
    session = await TestSession.create({
      project: { name: 'forceOrgList' },
      setupCommands: [
        'sfdx force:org:create -f config/project-scratch-def.json --setdefaultusername --wait 10',
        'sfdx force:org:create -f config/project-scratch-def.json --setalias anAlias --wait 10',
      ],
    });

    if (isArray<AnyJson>(session.setup)) {
      defaultUsername = getString(session.setup[0], 'result.username');
      defaultUserOrgId = getString(session.setup[0], 'result.orgId');
      aliasedUsername = getString(session.setup[1], 'result.username');
      aliasUserOrgId = getString(session.setup[1], 'result.orgId');
    }
  });

  it('delete scratch orgs via config', () => {
    const result = execCmd('force:org:delete --noprompt --json', {
      ensureExitCode: 0,
    }).jsonOutput.result;
    expect(result).to.be.ok;
    expect(result).to.deep.equal({ orgId: defaultUserOrgId, username: defaultUsername });
  });

  it('delete scratch orgs via alias', () => {
    const result = execCmd('force:org:delete --targetusername anAlias --noprompt --json', {
      ensureExitCode: 0,
    }).jsonOutput.result;
    expect(result).to.be.ok;
    expect(result).to.deep.equal({ orgId: aliasUserOrgId, username: aliasedUsername });
  });
});
