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

import path from 'node:path';
import fs from 'node:fs';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { assert, expect } from 'chai';
import { ScratchDeleteResponse } from '../../src/commands/org/delete/scratch.js';

describe('org:delete:scratch NUTs', () => {
  const scratchOrgAlias = 'scratch-org';
  const scratchOrgAlias2 = 'scratch-org-2';
  const scratchOrgAlias3 = 'scratch-org-3';
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: { name: 'scratchOrgDelete' },
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
