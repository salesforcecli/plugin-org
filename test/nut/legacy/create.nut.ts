/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { assert, expect } from 'chai';
import { TestSession, execCmd, genUniqueString } from '@salesforce/cli-plugins-testkit';
import { ScratchOrgCreateResult } from '@salesforce/core';

let session: TestSession;

describe('org:create command', () => {
  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'orgCreateNut',
      },
      devhubAuthStrategy: 'AUTO',
    });
  });

  describe('create with username', () => {
    const username = `${genUniqueString('orgCreateTests_')}@int-tests.org`;

    it('should create a new scratch org via definitionfile param', () => {
      const result = execCmd<ScratchOrgCreateResult>(
        `force:org:create -f ${path.join('config', 'project-scratch-def.json')} --json username=${username} -d 1 -w 60`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      assert(result);
      expect(result).to.have.all.keys(['username', 'authFields', 'orgId', 'scratchOrgInfo', 'warnings']);
      expect(result.username).to.equal(username.toLowerCase());
    });

    it('should return duplicate username error C-1007', () => {
      expect(process.env.SFDX_JSON_TO_STDOUT).to.not.equal('false');
      const errorOutput = execCmd(
        `force:org:create -f ${path.join('config', 'project-scratch-def.json')} --json username=${username} -d 1 -w 60`,
        {
          ensureExitCode: 1,
        }
      ).jsonOutput as unknown as { name: string };
      expect(errorOutput.name).to.be.a('string').and.include('C-1007');
    });
  });

  describe('create with alias', () => {
    const alias = 'MyAlias';

    it('should create a new scratch org using an alias', () => {
      const result = execCmd<ScratchOrgCreateResult>(
        `force:org:create -f ${path.join('config', 'project-scratch-def.json')} --json -a ${alias} -d 1 -w 60`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      expect(result).to.have.all.keys(['username', 'authFields', 'orgId', 'scratchOrgInfo', 'warnings']);
    });

    describe('create and delete by project default', () => {
      it('should create a new scratch org', () => {
        const result = execCmd<ScratchOrgCreateResult>(
          `force:org:create -f ${path.join('config', 'project-scratch-def.json')} --json -d 1 -s -w 60`,
          {
            ensureExitCode: 0,
          }
        ).jsonOutput?.result;
        expect(result).to.have.all.keys(['username', 'authFields', 'orgId', 'scratchOrgInfo', 'warnings']);
      });
    });

    describe('validation failures', () => {
      it('fails with no config/varargs', () => {
        execCmd('force:org:create --json --noprompt', {
          ensureExitCode: 1,
        });
      });
    });

    after(async () => {
      await session?.zip('orgCreateDelete.zip', 'artifacts');
      await session?.clean();
    });
  });
});
