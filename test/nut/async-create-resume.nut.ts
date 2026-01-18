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

import fs from 'node:fs';
import path from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { assert, expect } from 'chai';
import { AuthFields, Global, ScratchOrgCache } from '@salesforce/core';
import { Duration, sleep } from '@salesforce/kit';
import type { CachedOptions } from '../../node_modules/@salesforce/core/lib/org/scratchOrgCache.js';
import { ScratchCreateResponse } from '../../src/shared/orgTypes.js';

describe('env:create:scratch async/resume', () => {
  let session: TestSession;
  let cacheFilePath: string;
  let soiId: string;
  let username: string;

  const asyncKeys = ['username', 'scratchOrgInfo', 'warnings'];
  const completeKeys = [...asyncKeys, 'authFields', 'orgId'];

  const readCacheFile = async (): Promise<Record<string, CachedOptions>> =>
    JSON.parse(await fs.promises.readFile(cacheFilePath, 'utf8')) as unknown as Record<string, CachedOptions>;

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
      project: { name: 'asyncCreateResume' },
      devhubAuthStrategy: 'AUTO',
    });
    cacheFilePath = path.join(session.dir, '.sf', ScratchOrgCache.getFileName());
  });

  after(async () => {
    await session?.clean();
  });

  describe('just edition', () => {
    it('requests org', () => {
      const resp = execCmd<ScratchCreateResponse>('env:create:scratch --edition developer --json --async', {
        ensureExitCode: 0,
      }).jsonOutput?.result;
      expect(resp).to.have.all.keys(asyncKeys);
      assert(resp?.username);
      assert(resp?.scratchOrgInfo?.Id);
      soiId = resp.scratchOrgInfo.Id;
      username = resp.username;
    });
    it('is present in cache', async () => {
      expect(fs.existsSync(cacheFilePath)).to.be.true;
      const cache = await readCacheFile();
      expect(cache[soiId]).to.include.keys(['hubBaseUrl', 'definitionjson', 'hubUsername']);
      expect(cache[soiId].definitionjson).to.deep.equal({ edition: 'developer' });
    });
    it('resumes org using id', async () => {
      let done = false;
      while (!done) {
        const resp = execCmd<ScratchCreateResponse>(`env:resume:scratch --job-id ${soiId} --json`).jsonOutput;
        assert(resp);
        if (resp.status === 0) {
          done = true;
          expect(resp.result).to.have.all.keys(completeKeys);
          expect(resp.result.orgId).to.match(/^00D.{15}/);
        } else if (resp.name === 'StillInProgressError') {
          // eslint-disable-next-line no-await-in-loop
          await sleep(Duration.seconds(30));
        } else {
          throw new Error(resp.message);
        }
      }
    });
    it('org is authenticated', async () => {
      const authFile = await readAuthFile(username);
      expect(authFile).to.include.keys(['orgId', 'devHubUsername', 'accessToken']);
    });
    it('is NOT present in cache', async () => {
      const cache = await readCacheFile();
      expect(cache).to.not.have.property(soiId);
    });
  });

  describe('alias, set-default, username, config file, use-most-recent', () => {
    const testAlias = 'testAlias-resume';
    it('requests org', () => {
      const resp = execCmd<ScratchCreateResponse>(
        `env:create:scratch --json --async -f ${path.join(
          'config',
          'project-scratch-def.json'
        )} --set-default --alias ${testAlias}`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      expect(resp).to.have.all.keys(asyncKeys);
      assert(resp?.username);
      assert(resp?.scratchOrgInfo?.Id);
      soiId = resp.scratchOrgInfo.Id;
      username = resp.username;
    });
    it('is present in cache', async () => {
      expect(fs.existsSync(cacheFilePath)).to.be.true;
      const cache = await readCacheFile();

      expect(cache[soiId]).to.include.keys(['hubBaseUrl', 'definitionjson', 'hubUsername']);
      expect(cache[soiId]).to.have.property('setDefault', true);
      expect(cache[soiId].definitionjson).to.deep.equal(
        JSON.parse(
          await fs.promises.readFile(path.join(session.project.dir, 'config', 'project-scratch-def.json'), 'utf8')
        )
      );
    });
    it('resumes org using latest', async () => {
      let done = false;
      while (!done) {
        const resp = execCmd<ScratchCreateResponse>('env:resume:scratch --use-most-recent --json').jsonOutput;
        assert(resp);
        if (resp.status === 0) {
          done = true;
          expect(resp.result).to.have.all.keys(completeKeys);
        } else if (resp.name === 'StillInProgressError') {
          // eslint-disable-next-line no-await-in-loop
          await sleep(Duration.seconds(30));
        } else {
          throw new Error(resp.message);
        }
      }
    });
    it('org is authenticated with alias and config', async () => {
      const authFile = await readAuthFile(username);
      const aliases = await readAliases();
      expect(authFile).to.include.keys(['orgId', 'devHubUsername', 'accessToken']);
      expect(aliases.orgs[testAlias]).to.equal(username);

      const config = JSON.parse(
        await fs.promises.readFile(path.join(session.project.dir, '.sf', 'config.json'), 'utf8')
      ) as unknown as Record<string, string>;

      expect(config['target-org']).to.equal(testAlias);
    });
    it('is NOT present in cache', async () => {
      const cache = await readCacheFile();
      expect(cache).to.not.have.property(soiId);
    });
  });
});
