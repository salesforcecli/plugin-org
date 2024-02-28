/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import fs from 'node:fs';
import { TestSession, execCmd, genUniqueString } from '@salesforce/cli-plugins-testkit';
import { expect, config, assert } from 'chai';
import { AuthFields } from '@salesforce/core';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { OrgOpenOutput } from '../../src/commands/org/open.js';

let session: TestSession;
let defaultUsername: string;
let defaultUserOrgId: string;

config.truncateThreshold = 0;

describe('test org:open command', () => {
  const flexiPagePath = path.join('force-app', 'main', 'default', 'flexipages', 'Property_Explorer.flexipage-meta.xml');
  const flowPath = path.join('force-app', 'main', 'default', 'flows', 'Create_property.flow-meta.xml');

  before(async () => {
    const uid = genUniqueString('orgOpen_%s');
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc.git',
      },
      sessionDir: path.join(process.cwd(), `test_session_${uid}`),
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          alias: 'default',
          setDefault: true,
          config: path.join('config', 'project-scratch-def.json'),
        },
      ],
    });

    const defaultOrg = session.orgs.get('default') as AuthFields;
    defaultUsername = defaultOrg.username as string;
    defaultUserOrgId = defaultOrg.orgId as string;
  });

  it('should produce the default URL for a flexipage resource when it not in org in json', () => {
    const result = execCmd<OrgOpenOutput>(`force:source:open -f ${flexiPagePath} --urlonly --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    expect(result.url).to.include('lightning/setup/FlexiPageList/home');
  });

  it('should produce the URL for a flexipage resource in json', async () => {
    // we need stuff in the org
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(session.project.dir, 'force-app')] });
    const deploy = await cs.deploy({ usernameOrConnection: defaultUsername });
    const deployResult = await deploy.pollStatus(1000, 60_000);
    expect(deployResult.getFileResponses().length).to.not.equal(0);
    const result = execCmd<OrgOpenOutput>(`force:source:open --sourcefile ${flexiPagePath} --urlonly --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    expect(result.url).to.include('/visualEditor/appBuilder.app?pageId');
  });

  it('should produce the URL for an existing flow', () => {
    const result = execCmd<OrgOpenOutput>(`force:org:open --source-file ${flowPath} --url-only --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    expect(result.url).to.include('/builder_platform_interaction/flowBuilder.app?flowId=301');
  });

  it("should produce the org's frontdoor url when edition of file is not supported", async () => {
    const layoutDir = path.join('force-app', 'main', 'default', 'layouts');
    const layoutFilePath = path.join(layoutDir, 'MyLayout.layout-meta.xml');
    await fs.promises.writeFile(
      path.join(session.project.dir, layoutFilePath),
      '<layout xmlns="http://soap.sforce.com/2006/04/metadata">\n</layout>'
    );
    const result = execCmd<OrgOpenOutput>(`force:source:open --source-file ${layoutFilePath} --urlonly --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    expect(result.url).to.include('secur/frontdoor.jsp');
  });

  it('org:open command', () => {
    const result = execCmd<OrgOpenOutput>('force:org:open --urlonly --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.have.keys(['url', 'orgId', 'username']);
    expect(result?.url).to.include('/secur/frontdoor.jsp');
  });

  after(async () => {
    try {
      await session.zip(undefined, 'artifacts');
      await session.clean();
    } catch (e) {
      // don't throw if an error happened while cleaning up
    }
  });
});
