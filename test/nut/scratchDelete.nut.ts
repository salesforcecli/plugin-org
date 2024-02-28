/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import fs from 'node:fs';
import { execCmd, TestSession, genUniqueString } from '@salesforce/cli-plugins-testkit';
import { assert, expect } from 'chai';
import { ScratchDeleteResponse } from '../../src/commands/org/delete/scratch.js';

describe('org:delete:scratch NUTs', () => {
  const scratchOrgAlias = 'scratch-org';
  const scratchOrgAlias2 = 'scratch-org-2';
  const scratchOrgAlias3 = 'scratch-org-3';
  let session: TestSession;

  before(async () => {
    const uid = genUniqueString('scratchDelete_%s');
    session = await TestSession.create({
      project: { name: 'scratchOrgDelete' },
      sessionDir: path.join(process.cwd(), `test_session_${uid}`),
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          alias: scratchOrgAlias,
          duration: 1,
          config: path.join('config', 'project-scratch-def.json'),
        },
        {
          alias: scratchOrgAlias2,
          duration: 1,
          config: path.join('config', 'project-scratch-def.json'),
        },
        {
          setDefault: true,
          alias: scratchOrgAlias3,
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
      await fs.promises.rm(session.dir, { recursive: true }).catch(() => {});
    }
  });

  it('should delete the 1st scratch org by alias', () => {
    const command = `env:delete:scratch --target-org ${scratchOrgAlias} --no-prompt --json`;
    const output = execCmd<ScratchDeleteResponse>(command, { ensureExitCode: 0 }).jsonOutput?.result;
    assert(output);
    expect(output.username).to.equal(session.orgs.get(scratchOrgAlias)?.username);
  });

  it('should delete the 2nd scratch org by username', () => {
    const username = session.orgs.get(scratchOrgAlias2)?.username;
    const command = `env:delete:scratch --target-org ${username} --no-prompt --json`;
    const output = execCmd<ScratchDeleteResponse>(command, { ensureExitCode: 0 }).jsonOutput?.result;
    assert(output);
    expect(output.username).to.equal(session.orgs.get(scratchOrgAlias2)?.username);
  });

  it('should delete the 3rd scratch org because it is the default', () => {
    const command = 'env:delete:scratch --no-prompt --json';
    const output = execCmd<ScratchDeleteResponse>(command, { ensureExitCode: 0 }).jsonOutput?.result;
    assert(output);
    expect(output.username).to.equal(session.orgs.get('default')?.username);
  });
});
