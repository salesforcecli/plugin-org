/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs';
import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { expect, config } from 'chai';
import { AuthFields } from '@salesforce/core';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { OrgOpenOutput } from '../../lib/commands/org/open';

let session: TestSession;
let defaultUsername: string;
let defaultUserOrgId: string;

config.truncateThreshold = 0;

describe('test org:open command', () => {
  const flexiPagePath = path.join('force-app', 'main', 'default', 'flexipages', 'Property_Explorer.flexipage-meta.xml');

  before(async () => {
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc.git',
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          executable: 'sfdx',
          alias: 'default',
          duration: 1,
          setDefault: true,
          wait: 10,
          config: path.join('config', 'project-scratch-def.json'),
        },
      ],
    });

    const defaultOrg = session.orgs.get('default') as AuthFields;
    defaultUsername = defaultOrg.username as string;
    defaultUserOrgId = defaultOrg.orgId as string;
  });

  it('should produce the default URL for a flexipage resource when it not in org in json', () => {
    const result = (
      execCmd<OrgOpenOutput>(`force:source:open -f ${flexiPagePath} --urlonly --json`, {
        ensureExitCode: 0,
      }).jsonOutput as { result: OrgOpenOutput }
    ).result;
    expect(result).to.be.ok;
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    expect(result).to.property('url').to.include('lightning/setup/FlexiPageList/home');
  });

  it('should produce the URL for a flexipage resource in json', async () => {
    // we need stuff in the org
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(session.project.dir, 'force-app')] });
    const deploy = await cs.deploy({ usernameOrConnection: defaultUsername });
    const deployResult = await deploy.pollStatus(1000, 60000);
    expect(deployResult.getFileResponses().length).to.not.equal(0);
    const result = (
      execCmd<OrgOpenOutput>(`force:source:open --sourcefile ${flexiPagePath} --urlonly --json`, {
        ensureExitCode: 0,
      }).jsonOutput as { result: OrgOpenOutput }
    ).result;
    expect(result).to.be.ok;
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    expect(result).to.property('url').to.include('/visualEditor/appBuilder.app?pageId');
  });

  it("should produce the org's frontdoor url when edition of file is not supported", async () => {
    const layoutDir = path.join('force-app', 'main', 'default', 'layouts');
    const layoutFilePath = path.join(layoutDir, 'MyLayout.layout-meta.xml');
    await fs.promises.writeFile(
      path.join(session.project.dir, layoutFilePath),
      '<layout xmlns="http://soap.sforce.com/2006/04/metadata">\n</layout>'
    );
    const result = (
      execCmd<OrgOpenOutput>(`force:source:open --source-file ${layoutFilePath} --urlonly --json`, {
        ensureExitCode: 0,
      }).jsonOutput as { result: OrgOpenOutput }
    ).result;
    expect(result).to.be.ok;
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    expect(result).to.property('url').to.include('secur/frontdoor.jsp');
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
    try {
      await session.zip(undefined, 'artifacts');
      await session.clean();
    } catch (e) {
      // don't throw if an error happened while cleaning up
    }
  });
});
