/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { expect, config, assert } from 'chai';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { getString } from '@salesforce/ts-types';
import { OrgListResult } from '../../src/commands/org/list';
import { OrgOpenOutput } from '../../src/commands/org/open';
import { OrgDisplayReturn } from '../../src/shared/orgTypes';

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
  expect(devHubLine).to.include('(D)');
  expect(devHubLine).to.include('Connected');
  const defaultUserLine = lines.find((line) => line.includes(defaultUsername));
  assert(defaultUserLine);
  expect(defaultUserLine).to.include('(U)');
  const aliasUserLine = lines.find((line) => line.includes(aliasedUsername));
  assert(aliasUserLine);
  expect(aliasUserLine).to.include('anAlias');
  // verbose mode should display sractch org Id and dev hub org Id
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
  let defaultUserOrgId: string;
  let aliasUserOrgId: string;

  before(async () => {
    session = await TestSession.create({
      project: { name: 'forceOrgList' },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          executable: 'sfdx',
          config: join('config', 'project-scratch-def.json'),
          setDefault: true,
        },
        {
          executable: 'sfdx',
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
    defaultUserOrgId = defaultOrg.orgId;

    aliasedUsername = aliasOrg?.username;
    aliasUserOrgId = aliasOrg?.orgId;
  });

  after(async () => {
    await session?.clean();
  });

  describe('List Orgs', () => {
    it('should list all orgs', () => {
      const listResult = execCmd<OrgListResult>('force:org:list --json', { ensureExitCode: 0 }).jsonOutput?.result;
      assert(listResult);
      expect(listResult).to.have.property('nonScratchOrgs');
      expect(listResult.nonScratchOrgs).to.have.length(1);
      expect(listResult).to.have.property('scratchOrgs');
      expect(listResult.scratchOrgs).to.have.length(2);
      const scratchOrgs = listResult.scratchOrgs;
      expect(scratchOrgs.map((scratchOrg) => getString(scratchOrg, 'username'))).to.deep.equal([
        defaultUsername,
        aliasedUsername,
      ]);
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
    });
    it('should list orgs - skipconnectionstatus', () => {
      const listResult = execCmd<OrgListResult>('force:org:list --skipconnectionstatus --json', { ensureExitCode: 0 })
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
      const lines = execCmd('force:org:list', { ensureExitCode: 0 }).shellOutput.stdout.split('\n');
      verifyHumanResults(lines, defaultUsername, aliasedUsername);
    });
    it('should list additional information with --verbose', () => {
      const lines = execCmd('force:org:list --verbose', { ensureExitCode: 0 }).shellOutput.stdout.split('\n');
      verifyHumanResults(lines, defaultUsername, aliasedUsername, true);
    });
  });
  describe('Org Display', () => {
    it('should display org information for default username', () => {
      const result = execCmd<OrgListResult>('force:org:display --json', { ensureExitCode: 0 }).jsonOutput?.result;
      expect(result).to.be.ok;
      expect(result).to.include({
        devHubId: hubOrgUsername,
        username: defaultUsername,
      });
    });
    it('should display scratch org information for alias', () => {
      const result = execCmd<OrgListResult>(`force:org:display -u ${aliasedUsername} --json`, { ensureExitCode: 0 })
        .jsonOutput?.result;
      expect(result).to.be.ok;
      expect(result).to.include({
        devHubId: hubOrgUsername,
        username: aliasedUsername,
      });
    });
    it('should display human readable org information for default username', () => {
      const lines = execCmd<OrgDisplayReturn>('force:org:display', { ensureExitCode: 0 }).shellOutput.stdout.split(
        '\n'
      );
      expect(lines.length).to.have.greaterThan(0);
      const usernameLine = lines.find((line) => line.includes('Username'));
      expect(usernameLine).to.include(defaultUsername);
    });
    it('should display human readable scratch org information for alias', () => {
      const lines = execCmd(`force:org:display -u ${aliasedUsername}`, { ensureExitCode: 0 }).shellOutput.stdout.split(
        '\n'
      );
      expect(lines.length).to.have.greaterThan(0);
      const usernameLine = lines.find((line) => line.includes('Username'));
      expect(usernameLine).to.include(aliasedUsername);
    });
  });
  describe('Org Open', () => {
    it('should produce the URL for an org in json', () => {
      const result = execCmd<OrgOpenOutput>(`force:org:open -u ${defaultUsername} --urlonly --json`, {
        ensureExitCode: 0,
      }).jsonOutput?.result;
      expect(result).to.be.ok;
      expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    });
    it('should produce the URL with given path for an org in json', () => {
      const result = execCmd<OrgOpenOutput>(
        `force:org:open -u ${aliasedUsername} --urlonly --path "foo/bar/baz" --json`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      expect(result).to.be.ok;
      expect(result).to.include({ orgId: aliasUserOrgId, username: aliasedUsername });
      expect(result)
        .to.property('url')
        .to.include(`retURL=${encodeURIComponent(decodeURIComponent('foo/bar/baz'))}`);
    });
  });
});
