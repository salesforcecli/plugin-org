/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { ScratchDeleteResponse } from '../../../../src/commands/env/delete/scratch';

describe('env delete scratch NUTs', () => {
  const scratchOrgAlias = 'scratch-org';
  const scratchOrgAlias2 = 'scratch-org-2';
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'testProject',
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          executable: 'sf',
          alias: scratchOrgAlias,
          duration: 1,
          config: path.join('config', 'project-scratch-def.json'),
        },
        {
          executable: 'sf',
          alias: scratchOrgAlias2,
          duration: 1,
          config: path.join('config', 'project-scratch-def.json'),
        },
        {
          executable: 'sf',
          setDefault: true,
          duration: 1,
          config: path.join('config', 'project-scratch-def.json'),
        },
      ],
    });
  });

  after(async () => {
    // clean restores sinon, but will throw when it tries to delete the already-deleted orgs.
    // so catch that and delete the dir manually
    try {
      await session?.clean();
    } catch {
      await fs.promises.rmdir(session.dir, { recursive: true }).catch(() => {});
    }
  });

  it('should see default username in help', () => {
    const output = execCmd<ScratchDeleteResponse>('env delete scratch --help', { ensureExitCode: 0 }).shellOutput;
    expect(output).to.include(session.orgs.get('default').username);
  });

  it('should delete the 1st scratch org by alias', () => {
    const command = `env delete scratch --target-org ${scratchOrgAlias} --no-prompt --json`;
    const output = execCmd<ScratchDeleteResponse>(command, { ensureExitCode: 0 }).jsonOutput.result;
    expect(output.username).to.equal(session.orgs.get(scratchOrgAlias).username);
  });

  it('should delete the 2nd scratch org by username', () => {
    const username = session.orgs.get(scratchOrgAlias2).username;
    const command = `env delete scratch --target-org ${username} --no-prompt --json`;
    const output = execCmd<ScratchDeleteResponse>(command, { ensureExitCode: 0 }).jsonOutput.result;
    expect(output.username).to.equal(session.orgs.get(scratchOrgAlias2).username);
  });

  it('should delete the 3rd scratch org because it is the default', () => {
    const command = 'env delete scratch --no-prompt --json';
    const output = execCmd<ScratchDeleteResponse>(command, { ensureExitCode: 0 }).jsonOutput.result;
    expect(output.username).to.equal(session.orgs.get('default').username);
  });
});
