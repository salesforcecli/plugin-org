/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { OrgOpenOutput } from '../../src/commands/org/open';

let session: TestSession;

describe('test org:open command', () => {
  before(async () => {
    session = await TestSession.create({
      project: { name: 'forceOrgList' },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          executable: 'sfdx',
          config: join('config', 'project-scratch-def.json'),
          setDefault: true,
          wait: 10,
        },
      ],
    });
  });

  it('org:open command', async () => {
    const result = execCmd<OrgOpenOutput>('force:org:open --urlonly --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    expect(result).to.be.ok;
    expect(result).to.have.keys(['url', 'orgId', 'username']);
    expect(result?.url).to.include('/secur/frontdoor.jsp');
  });

  after(async () => {
    await session.zip(undefined, 'artifacts');
    await session.clean();
  });
});
