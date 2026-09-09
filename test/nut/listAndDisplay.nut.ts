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

import { join } from 'node:path';
import os from 'node:os';
import { expect, config, assert } from 'chai';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { OrgListResult, defaultHubEmoji, defaultOrgEmoji } from '../../src/commands/org/list.js';
import { OrgDisplayReturn } from '../../src/shared/orgTypes.js';

let hubOrgUsername: string;
config.truncateThreshold = 0;

const verifyHumanResults = (
  lines: string[],
  defaultUsername: string,
  aliasedUsername: string,
  verbose = false
): void => {
  expect(lines.length).to.have.greaterThan(0);
  const devHubLine = lines.find((line) => line.includes(hubOrgUsername));
  assert(devHubLine);
  expect(devHubLine).to.include(defaultHubEmoji);
  expect(devHubLine).to.include('Connected');
  const defaultUserLine = lines.find((line) => line.includes(defaultUsername));
  assert(defaultUserLine);
  expect(defaultUserLine).to.include(defaultOrgEmoji);
  const aliasUserLine = lines.find((line) => line.includes(aliasedUsername));
  assert(aliasUserLine);
  expect(aliasUserLine).to.include('anAlias');
  // verbose mode should display scratch org Id and dev hub org Id
  if (verbose) {
    expect(defaultUserLine.match(/00D/g)).to.have.lengthOf(2, defaultUserLine);
    expect(aliasUserLine.match(/00D/g)).to.have.lengthOf(2, aliasUserLine);
  } else {
    expect(defaultUserLine.match(/00D/g)).to.have.lengthOf(1, defaultUserLine);
    expect(aliasUserLine.match(/00D/g)).to.have.lengthOf(1, aliasUserLine);
  }
};

describe('Org Command NUT', () => {
  let session: TestSession;
  let defaultUsername: string;
  let aliasedUsername: string;

  before(async () => {
    session = await TestSession.create({
      project: { name: 'listAndDisplay' },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          config: join('config', 'project-scratch-def.json'),
          setDefault: true,
        },
        {
          config: join('config', 'project-scratch-def.json'),
          alias: 'anAlias',
        },
      ],
    });

    assert(session.hubOrg.username);
    hubOrgUsername = session.hubOrg?.username;

    const defaultOrg = session.orgs.get('default');
    const aliasOrg = session.orgs.get('anAlias');

    assert(defaultOrg?.username);
    assert(defaultOrg?.orgId);
    assert(aliasOrg?.username);
    assert(aliasOrg?.orgId);

    defaultUsername = defaultOrg.username;

    aliasedUsername = aliasOrg?.username;
  });

  after(async () => {
    await session?.clean();
  });

  describe('List Orgs', () => {
    it('should list all orgs', () => {
      const listResult = execCmd<OrgListResult>('org:list --json', { ensureExitCode: 0 }).jsonOutput?.result;
      assert(listResult);
      expect(listResult).to.have.property('nonScratchOrgs');
      expect(listResult.nonScratchOrgs).to.have.length(1);
      expect(listResult).to.have.property('scratchOrgs');
      expect(listResult.scratchOrgs).to.have.length(2);
      const scratchOrgs = listResult.scratchOrgs;
      expect(scratchOrgs.map((scratchOrg) => scratchOrg.username)).to.deep.equal([aliasedUsername, defaultUsername]);
      expect(scratchOrgs.find((org) => org.username === defaultUsername)).to.include({
        defaultMarker: '(U)',
        isDefaultUsername: true,
        namespace: null,
      });
      expect(scratchOrgs.find((org) => org.username === aliasedUsername)).to.include({
        alias: 'anAlias',
        namespace: null,
      });
      expect(listResult.nonScratchOrgs[0]).to.include(
        {
          username: hubOrgUsername,
          defaultMarker: '(D)',
          isDevHub: true,
          connectedStatus: 'Connected',
        },
        JSON.stringify(listResult.nonScratchOrgs[0])
      );
      expect(listResult.devHubs[0]).to.include(
        {
          username: hubOrgUsername,
          defaultMarker: '(D)',
          isDevHub: true,
          connectedStatus: 'Connected',
        },
        JSON.stringify(listResult.nonScratchOrgs[0])
      );
    });
    it('should list orgs - skip-connection-status', () => {
      const listResult = execCmd<OrgListResult>('org:list --skip-connection-status --json', { ensureExitCode: 0 })
        .jsonOutput?.result;
      assert(listResult);
      const nonScratchOrgs = listResult.nonScratchOrgs[0];
      expect(nonScratchOrgs).to.include(
        {
          username: hubOrgUsername,
          defaultMarker: '(D)',
          isDevHub: true,
        },
        JSON.stringify(nonScratchOrgs)
      );
    });
    it('should list orgs in a human readable form', () => {
      const stdout = execCmd('org:list', { ensureExitCode: 0 }).shellOutput.stdout;
      let lines = stdout.split(os.EOL);
      if (lines.length === 1) {
        lines = stdout.split('\n');
      }
      verifyHumanResults(lines, defaultUsername, aliasedUsername);
    });
    it('should list additional information with --verbose', () => {
      const stdout = execCmd('org:list --verbose', { ensureExitCode: 0 }).shellOutput.stdout;
      let lines = stdout.split(os.EOL);
      if (lines.length === 1) {
        lines = stdout.split('\n');
      }
      verifyHumanResults(lines, defaultUsername, aliasedUsername, true);
    });
  });
  describe('Org Display', () => {
    it('should display org information for default username', () => {
      const result = execCmd<OrgListResult>('org:display --json', { ensureExitCode: 0 }).jsonOutput?.result;
      expect(result).to.be.ok;
      expect(result).to.include({
        devHubId: hubOrgUsername,
        username: defaultUsername,
      });
    });
    it('should display scratch org information for alias', () => {
      const result = execCmd<OrgListResult>(`org:display -u ${aliasedUsername} --json`, { ensureExitCode: 0 })
        .jsonOutput?.result;
      expect(result).to.be.ok;
      expect(result).to.include({
        devHubId: hubOrgUsername,
        username: aliasedUsername,
      });
    });
    it('should display human readable org information for default username', () => {
      const result = execCmd<OrgDisplayReturn>('org:display', { ensureExitCode: 0 }).shellOutput;
      const stdout = result.stdout;
      const lines = stdout.split(os.EOL);
      expect(lines.length).to.have.greaterThan(0);
      const usernameLine = lines.find((line) => line.includes('Username'));
      expect(usernameLine).to.include(defaultUsername);
    });
    it('should display human readable scratch org information for alias', () => {
      const lines = execCmd(`force:org:display -o ${aliasedUsername}`, { ensureExitCode: 0 }).shellOutput.stdout.split(
        os.EOL
      );
      expect(lines.length).to.have.greaterThan(0);
      const usernameLine = lines.find((line) => line.includes('Username'));
      expect(usernameLine).to.include(aliasedUsername);
    });
  });
});
