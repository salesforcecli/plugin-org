/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';

import { execCmd, genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { assert, expect } from 'chai';
import { AuthFields, Messages, Global, StateAggregator } from '@salesforce/core';
import { ScratchCreateResponse } from '../../src/shared/orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create_scratch');
describe('env create scratch NUTs', () => {
  let session: TestSession;

  const readAuthFile = async (uname: string): Promise<AuthFields> => {
    const filePath = path.join(session.homeDir, Global.STATE_FOLDER, `${uname}.json`);
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8')) as AuthFields;
  };

  const readAliases = async (): Promise<Record<'orgs', Record<string, string>>> => {
    const filePath = path.join(session.homeDir, Global.STATE_FOLDER, 'alias.json');
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8')) as Record<'orgs', Record<string, string>>;
  };

  before(async () => {
    session = await TestSession.create({
      project: { name: 'scratchOrgCreate' },
      devhubAuthStrategy: 'AUTO',
    });
  });

  after(async () => {
    await session?.clean();
  });

  describe('flag failures', () => {
    it('non-existent config file', () => {
      execCmd('env:create:scratch -f badfile.json', { ensureExitCode: 'nonZero' });
    });
    it('wait zero', () => {
      execCmd('env:create:scratch -f config/project-scratch-def.json --wait 0', { ensureExitCode: 'nonZero' });
    });
    it('no edition or config', () => {
      execCmd('env:create:scratch', { ensureExitCode: 'nonZero' });
    });
    it('days out of bounds', () => {
      execCmd('env:create:scratch -f config/project-scratch-def.json -d 50', { ensureExitCode: 'nonZero' });
    });
    it('prompts for client secret if client id present and times out', () => {
      const error = execCmd('env:create:scratch --edition developer --client-id someConnectedApp', {
        ensureExitCode: 'nonZero',
      }).shellOutput;
      expect(error.stdout).to.include(messages.getMessage('prompt.secret'));
      expect(error.stderr).to.include('Prompt timed out.');
    });
  });

  describe('successes', () => {
    const keys = ['username', 'orgId', 'scratchOrgInfo', 'authFields', 'warnings'];

    it('creates an org from edition flag only and sets tracking to true by default', async () => {
      const resp = execCmd<ScratchCreateResponse>('env:create:scratch --edition developer --json  --wait 60', {
        ensureExitCode: 0,
      }).jsonOutput?.result;
      expect(resp).to.have.all.keys(keys);
      assert(resp?.username);
      expect(resp?.orgId).to.match(/^00D.{15}/);
      const stateAggregator = await StateAggregator.create();
      expect(await stateAggregator.orgs.read(resp.username)).to.have.property('tracksSource', true);
      StateAggregator.clearInstance();
    });
    it('creates an org from config file flag only', () => {
      const resp = execCmd<ScratchCreateResponse>(
        'env:create:scratch -f config/project-scratch-def.json --json  --wait 60',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      expect(resp).to.have.all.keys(keys);
      expect(resp?.orgId).to.match(/^00D.{15}/);
    });
    it('creates an org from config file with "override" flags and custom admin email', () => {
      const expectedUsername = genUniqueString('%s@nut.org');
      const resp = execCmd<ScratchCreateResponse>(
        `env:create:scratch -f config/project-scratch-def.json --json --username ${expectedUsername} --description "new one" --name TheOrg --wait 60 --admin-email shane@mailinator.com`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      expect(resp).to.have.all.keys(keys);
      expect(resp?.username).to.equal(expectedUsername);
      expect(resp?.scratchOrgInfo?.AdminEmail).to.equal('shane@mailinator.com');
    });
    it('creates an org with tracking disabled ', async () => {
      const resp = execCmd<ScratchCreateResponse>(
        'env:create:scratch --edition developer --no-track-source --json  --wait 60',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      expect(resp).to.have.all.keys(keys);
      assert(resp?.username);

      const stateAggregator = await StateAggregator.create();
      expect(await stateAggregator.orgs.read(resp.username)).to.have.property('tracksSource', false);
      StateAggregator.clearInstance();
    });

    it('stores default in local sf config', async () => {
      const resp = execCmd<ScratchCreateResponse>(
        'env:create:scratch --edition developer --json --set-default  --wait 60',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      expect(resp).to.have.all.keys(keys);
      assert(resp?.username);

      expect(
        JSON.parse(await fs.promises.readFile(path.join(session.project.dir, '.sf', 'config.json'), 'utf8'))
      ).to.have.property('target-org', resp.username);
    });
    it('stores alias in global sf.json', async () => {
      const testAlias = 'testAlias';
      const resp = execCmd<ScratchCreateResponse>(
        `env:create:scratch --edition developer --json --alias ${testAlias}  --wait 60`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      expect(resp).to.have.all.keys(keys);
      assert(resp?.username);

      const authFile = await readAuthFile(resp.username);
      expect(authFile).to.include.keys(['orgId', 'devHubUsername', 'accessToken']);

      const aliases = await readAliases();
      expect(aliases.orgs).to.have.property(testAlias, resp.username);
    });
  });
});
