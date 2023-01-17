/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AuthFields, Global, ScratchOrgCache } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { CachedOptions } from '@salesforce/core/lib/org/scratchOrgCache';
import { Duration, sleep } from '@salesforce/kit';
import { ScratchCreateResponse } from '../../../../src/types';

describe('env create scratch async/resume', () => {
  let session: TestSession;
  let cacheFilePath: string;
  let soiId: string;
  let username: string;

  const asyncKeys = ['username', 'orgId', 'scratchOrgInfo', 'warnings'];
  const completeKeys = [...asyncKeys, 'authFields'];

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
      project: { name: 'testProject' },
      devhubAuthStrategy: 'AUTO',
    });
    cacheFilePath = path.join(session.dir, '.sf', ScratchOrgCache.getFileName());
  });

  after(async () => {
    await session?.clean();
  });

  describe('just edition', () => {
    it('requests org', () => {
      const resp = execCmd<ScratchCreateResponse>('env create scratch --edition developer --json --async', {
        ensureExitCode: 0,
      }).jsonOutput.result;
      expect(resp).to.have.all.keys(asyncKeys);
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
        const resp = execCmd<ScratchCreateResponse>(`env resume scratch --job-id ${soiId} --json`).jsonOutput;
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
    const testAlias = 'testAlias';
    it('requests org', () => {
      const resp = execCmd<ScratchCreateResponse>(
        `env create scratch --json --async -f ${path.join(
          'config',
          'project-scratch-def.json'
        )} --set-default --alias ${testAlias}`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput.result;
      expect(resp).to.have.all.keys(asyncKeys);
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
        ) as unknown as JsonMap
      );
    });
    it('resumes org using latest', async () => {
      let done = false;
      while (!done) {
        const resp = execCmd<ScratchCreateResponse>('env resume scratch --use-most-recent --json').jsonOutput;
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
