/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as querystring from 'querystring';
import { expect } from '@salesforce/command/lib/test';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { asDictionary, AnyJson, Dictionary, getString, isArray } from '@salesforce/ts-types';

const verifyHumanResults = (
  lines: string[],
  defaultUsername: string,
  aliasedUsername: string,
  verbose = false
): void => {
  expect(lines.length).to.have.greaterThan(0);
  const devHubLine = lines.find((line) => line.includes(process.env.TESTKIT_HUB_USERNAME));
  expect(devHubLine).to.be.ok;
  expect(devHubLine).to.include('(D)');
  expect(devHubLine).to.include('Connected');
  const defaultUserLine = lines.find((line) => line.includes(defaultUsername));
  expect(defaultUserLine).to.be.ok;
  expect(defaultUserLine).to.include('(U)');
  const aliasUserLine = lines.find((line) => line.includes(aliasedUsername));
  expect(aliasUserLine).to.be.ok;
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
      setupCommands: [
        'sfdx force:org:create -f config/project-scratch-def.json --setdefaultusername --wait 10',
        'sfdx force:org:create -f config/project-scratch-def.json --setalias anAlias --wait 10',
      ],
    });

    if (isArray<AnyJson>(session.setup)) {
      defaultUsername = getString(session.setup[0], 'result.username');
      defaultUserOrgId = getString(session.setup[0], 'result.orgId');
      aliasedUsername = getString(session.setup[1], 'result.username');
      aliasUserOrgId = getString(session.setup[1], 'result.orgId');
    }
  });

  after(async () => {
    await session?.clean();
  });

  describe('List Orgs', () => {
    it('should list all orgs', () => {
      const listResult = execCmd<Dictionary>('force:org:list --json', { ensureExitCode: 0 }).jsonOutput.result;
      expect(listResult).to.have.property('nonScratchOrgs');
      expect(listResult.nonScratchOrgs).to.have.length(1);
      expect(listResult).to.have.property('scratchOrgs');
      expect(listResult.scratchOrgs).to.have.length(2);
      const nonScratchOrgs = asDictionary(listResult.nonScratchOrgs[0]);
      const scratchOrgs = listResult.scratchOrgs as unknown[];
      expect(scratchOrgs.map((scratchOrg) => getString(scratchOrg, 'username'))).to.deep.equal([
        defaultUsername,
        aliasedUsername,
      ]);
      expect(scratchOrgs.map((org) => asDictionary(org)).find((org) => org.username === defaultUsername)).to.include({
        defaultMarker: '(U)',
        isDefaultUsername: true,
        namespace: null,
      });
      expect(scratchOrgs.map((org) => asDictionary(org)).find((org) => org.username === aliasedUsername)).to.include({
        alias: 'anAlias',
        namespace: null,
      });
      expect(nonScratchOrgs).to.include(
        {
          username: process.env.TESTKIT_HUB_USERNAME,
          defaultMarker: '(D)',
          isDevHub: true,
          connectedStatus: 'Connected',
        },
        JSON.stringify(nonScratchOrgs)
      );
    });
    it('should list orgs - skipconnectionstatus', () => {
      const listResult = execCmd<Dictionary>('force:org:list --skipconnectionstatus --json', { ensureExitCode: 0 })
        .jsonOutput.result;
      const nonScratchOrgs = asDictionary(listResult.nonScratchOrgs[0]);
      expect(nonScratchOrgs).to.include(
        {
          username: process.env.TESTKIT_HUB_USERNAME,
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
      const result = execCmd<Dictionary>('force:org:display --json', { ensureExitCode: 0 }).jsonOutput.result;
      expect(result).to.be.ok;
      expect(result).to.include({
        devHubId: process.env.TESTKIT_HUB_USERNAME,
        username: defaultUsername,
      });
    });
    it('should display scratch org information for alias', () => {
      const result = execCmd<Dictionary>(`force:org:display -u ${aliasedUsername} --json`, { ensureExitCode: 0 })
        .jsonOutput.result;
      expect(result).to.be.ok;
      expect(result).to.include({
        devHubId: process.env.TESTKIT_HUB_USERNAME,
        username: aliasedUsername,
      });
    });
    it('should display human readable org information for default username', () => {
      const lines = execCmd<Dictionary>('force:org:display', { ensureExitCode: 0 }).shellOutput.stdout.split('\n');
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
      const result = execCmd<Dictionary>(`force:org:open -u ${defaultUsername} --urlonly --json`, { ensureExitCode: 0 })
        .jsonOutput.result;
      expect(result).to.be.ok;
      expect(result).to.include({ orgId: defaultUserOrgId, username: defaultUsername });
    });
    it('should produce the URL with given path for an org in json', () => {
      const result = execCmd(`force:org:open -u ${aliasedUsername} --urlonly --path "foo/bar/baz" --json`, {
        ensureExitCode: 0,
      }).jsonOutput.result;
      expect(result).to.be.ok;
      expect(result).to.include({ orgId: aliasUserOrgId, username: aliasedUsername });
      expect(result)
        .to.property('url')
        .to.include(`retURL=${querystring.escape('foo/bar/baz')}`);
    });
  });
});
