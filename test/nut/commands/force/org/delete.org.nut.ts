/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
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
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          executable: 'sfdx',
          setDefault: true,
          wait: 10,
          config: join('config', 'project-scratch-def.json'),
        },
        {
          executable: 'sfdx',
          alias: 'anAlias',
          wait: 10,
          config: join('config', 'project-scratch-def.json'),
        },
      ],
    });

    defaultUsername = session.orgs.get('default').username;
    defaultUserOrgId = session.orgs.get('default').orgId;

    aliasedUsername = session.orgs.get('anAlias').username;
    aliasUserOrgId = session.orgs.get('anAlias').orgId;
  });

  after(async () => {
    try {
      await session?.clean();
    } catch (e) {
      // do nothing, session?.clean() will try to remove files already removed by the org:delete and throw an error
      // it will also unwrap other stubbed methods
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

  describe.skip('sandbox', () => {
    // TODO: figure out how to test sandboxes in NUTs
  });
});
