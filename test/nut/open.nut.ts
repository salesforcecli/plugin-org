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
import { assert, config, expect } from 'chai';
import { AuthFields } from '@salesforce/core';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { ensureString } from '@salesforce/ts-types';
import { OrgOpenOutput } from '../../src/shared/orgTypes.js';

let session: TestSession;
let defaultUsername: string;
let defaultUserOrgId: string;
let defaultOrgInstanceUrl: string;

config.truncateThreshold = 0;

describe('test org:open command', () => {
  const flexiPagePath = path.join('force-app', 'main', 'default', 'flexipages', 'Property_Explorer.flexipage-meta.xml');
  const flowPath = path.join('force-app', 'main', 'default', 'flows', 'Create_property.flow-meta.xml');

  before(async () => {
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc.git',
      },
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
    defaultOrgInstanceUrl = defaultOrg.instanceUrl as string;
  });

  it('will get the correct url (harccoded)', () => {
    const result = execCmd<OrgOpenOutput>('org open authoring-bundle --urlonly --json', { ensureExitCode: 0 })
      .jsonOutput!.result;
    assert(result);
    expect(result.orgId).to.to.equal(defaultUserOrgId);
    expect(result.username).to.to.equal(defaultUsername);
    expect(result.url).to.include('lightning%2Fn%2Fstandard-AgentforceStudio');
  });

  it('should produce the frontdoor default URL for a flexipage resource when it not in org in json', () => {
    const result = execCmd<OrgOpenOutput>(`force:source:open -f ${flexiPagePath} --urlonly --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    validateFrontdoorUrl(result.url, undefined, defaultOrgInstanceUrl);
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
    validateFrontdoorUrl(
      result.url,
      {
        pattern: /^\/visualEditor\/appBuilder\.app\?pageId=[a-zA-Z0-9]{15,18}$/,
        shouldContain: ['/visualEditor/appBuilder.app', 'pageId='],
        idPattern: /pageId=([a-zA-Z0-9]{15,18})/,
      },
      defaultOrgInstanceUrl
    );
  });

  it('should produce the URL for an existing flow', () => {
    const result = execCmd<OrgOpenOutput>(`force:org:open --source-file ${flowPath} --url-only --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    validateFrontdoorUrl(
      result.url,
      {
        pattern: /^\/builder_platform_interaction\/flowBuilder\.app\?flowId=[a-zA-Z0-9]{15,18}$/,
        shouldContain: ['flowBuilder.app', 'flowId='],
        idPattern: /flowId=([a-zA-Z0-9]{15,18})/,
      },
      defaultOrgInstanceUrl
    );
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
    validateFrontdoorUrl(
      result.url,
      {
        exactMatch: '/lightning/setup/FlexiPageList/home',
      },
      defaultOrgInstanceUrl
    );
  });

  it('should produce the frontdoor URL to open the setup home', () => {
    const result = execCmd<OrgOpenOutput>('force:org:open --urlonly --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.have.keys(['url', 'orgId', 'username']);
    validateFrontdoorUrl(result.url, undefined, defaultOrgInstanceUrl);
  });

  it('should properly encode path parameters with slashes', () => {
    const testPath = 'lightning/setup/AsyncApiJobStatus/home';
    const result = execCmd<OrgOpenOutput>(`force:org:open --path "${testPath}" --urlonly --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    // The path should be single URL encoded (foo%2Fbar%2Fbaz), not double encoded
    validateFrontdoorUrl(
      result.url,
      {
        exactMatch: 'lightning/setup/AsyncApiJobStatus/home',
      },
      defaultOrgInstanceUrl
    );
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

type StartUrlValidationOptions = {
  pattern?: RegExp;
  exactMatch?: string;
  shouldContain?: string[];
  shouldStartWith?: string;
  shouldEndWith?: string;
  idPattern?: RegExp; // For extracting and validating Salesforce IDs
};

// Utility function to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Enhanced helper function to validate frontdoor URLs with flexible start URL validation
function validateFrontdoorUrl(
  urlString: string,
  startUrlOptions?: StartUrlValidationOptions,
  expectedInstanceUrl?: string
): void {
  const url = new URL(urlString);

  // Validate instance URL if provided
  if (expectedInstanceUrl) {
    const instanceUrl = new URL(expectedInstanceUrl);
    expect(url.hostname).to.equal(instanceUrl.hostname);
  } else {
    // Validate it's a Salesforce domain
    expect(url.hostname).to.match(/\.salesforce\.com$/);
  }

  // Validate it's the frontdoor endpoint
  expect(url.pathname).to.equal('/secur/frontdoor.jsp');

  // Validate required query parameters
  expect(url.searchParams.has('otp')).to.be.true;
  expect(url.searchParams.has('cshc')).to.be.true;

  if (startUrlOptions) {
    const actualStartUrl = url.searchParams.get('startURL');
    expect(actualStartUrl).to.not.be.null;

    const decodedStartUrl = decodeURIComponent(ensureString(actualStartUrl));

    if (startUrlOptions.exactMatch) {
      expect(decodedStartUrl).to.equal(startUrlOptions.exactMatch);
    }

    if (startUrlOptions.pattern) {
      expect(decodedStartUrl).to.match(startUrlOptions.pattern);
    }

    if (startUrlOptions.shouldContain) {
      startUrlOptions.shouldContain.forEach((substring) => {
        expect(decodedStartUrl).to.include(substring);
      });
    }

    if (startUrlOptions.shouldStartWith) {
      expect(decodedStartUrl).to.match(new RegExp(`^${escapeRegExp(startUrlOptions.shouldStartWith)}`));
    }

    if (startUrlOptions.shouldEndWith) {
      expect(decodedStartUrl).to.match(new RegExp(`${escapeRegExp(startUrlOptions.shouldEndWith)}$`));
    }

    if (startUrlOptions.idPattern) {
      expect(decodedStartUrl).to.match(startUrlOptions.idPattern);
    }
  } else {
    // If no startURL options provided, expect no startURL parameter
    expect(url.searchParams.get('startURL')).to.be.null;
  }
}
