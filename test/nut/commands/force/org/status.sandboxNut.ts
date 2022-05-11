/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import * as shell from 'shelljs';
import { AuthInfo, Connection, SandboxProcessObject } from '@salesforce/core';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';

let session: TestSession;
let sandboxName: string;

function unsetAlias() {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  shell.exec(`sfdx alias:unset ${sandboxName}`, execOptions) as shell.ShellString;
}

function unsetConfig() {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  shell.exec('sfdx config:unset defaultusername -g', execOptions) as shell.ShellString;
}

function logoutSandbox(username: string) {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  const rv = shell.exec(`sfdx auth:logout -u ${username}.${sandboxName} --noprompt`, execOptions) as shell.ShellString;
  if (rv.code !== 0) {
    throw new Error(`sfdx auth:logout failed with error:\n${rv.stderr}`);
  }
}

describe('test sandbox status command', () => {
  const env = new Env();
  let username: string;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: path.join(process.cwd(), 'test', 'nut', 'commands', 'force', 'org'),
      },
    });
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    const queryStr =
      "SELECT SandboxName FROM SandboxProcess WHERE Status != 'E' and Status != 'D' ORDER BY CreatedDate DESC LIMIT 1";
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username }),
    });
    const queryResult = (await connection.tooling.query(queryStr)) as { records: SandboxProcessObject[] };
    expect(queryResult?.records?.length).to.equal(1);
    sandboxName = queryResult?.records[0]?.SandboxName;
  });

  afterEach(() => {
    unsetAlias();
    unsetConfig();
    logoutSandbox(username);
  });

  it('sandbox status command', async () => {
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:status --sandboxname ${sandboxName} -u ${username} --json`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput.result;
    expect(orgStatusResult).to.be.a('object');
    expect(orgStatusResult).to.have.all.keys([
      'attributes',
      'Id',
      'Status',
      'SandboxName',
      'SandboxInfoId',
      'LicenseType',
      'CreatedDate',
      'CopyProgress',
      'SandboxOrganization',
      'SourceId',
      'Description',
      'EndDate',
    ]);
  });

  it('sandbox status command sets setdefaultusername', async () => {
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:status --sandboxname ${sandboxName} -u ${username} -s --json`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput.result;
    expect(orgStatusResult).to.be.ok;
    const execOptions: shell.ExecOptions = {
      silent: true,
    };
    const result = shell.exec('sfdx config:get defaultusername --json', execOptions) as shell.ShellString;
    expect(result.code).to.equal(0);
    expect(result.stdout).to.contain(`"${username}.${sandboxName}"`);
  });

  it('sandbox status command set alias', async () => {
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:status --sandboxname ${sandboxName} -u ${username} -a ${sandboxName} --json`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput.result;
    expect(orgStatusResult).to.be.ok;
    const execOptions: shell.ExecOptions = {
      silent: true,
    };
    const result = shell.exec('sfdx alias:list --json', execOptions) as shell.ShellString;
    expect(result.code).to.equal(0);
    expect(result.stdout).to.contain(`"${sandboxName}"`);
  });

  after(async () => {
    await session.zip(undefined, 'artifacts');
    await session.clean();
  });
});
