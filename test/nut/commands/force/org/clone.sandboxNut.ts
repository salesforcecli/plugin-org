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
let sourceSandboxName: string;
let clonedSandboxName: string;

const randomSandboxName = async () => {
  const env = new Env();
  const username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
  const connection = await Connection.create({
    authInfo: await AuthInfo.create({ username }),
  });
  let sandboxName: string;
  let queryResult: { records: SandboxProcessObject[] };
  // Make sure there are no duplicate sandbox names
  while (queryResult?.records?.length !== 1) {
    sandboxName = `sbx${Array(7)
      .fill(0)
      .map((x) => Math.random().toString(36).charAt(2))
      .join('')}`;
    const queryStr = `SELECT SandboxName FROM SandboxProcess WHERE SandboxName = ${sandboxName} ORDER BY CreatedDate DESC LIMIT 1`;
    queryResult = (await connection.tooling.query(queryStr)) as { records: SandboxProcessObject[] };
  }
  return sandboxName;
};

function unsetAlias() {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  shell.exec(`sfdx alias:unset ${clonedSandboxName}`, execOptions) as shell.ShellString;
}

function unsetConfig() {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  shell.exec('sfdx config:unset defaultusername -g', execOptions) as shell.ShellString;
}

function deleteSandbox(username: string) {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  const rv = shell.exec(
    `sfdx force:org:delete -u ${username}.${clonedSandboxName} --noprompt`,
    execOptions
  ) as shell.ShellString;
  if (rv.code !== 0) {
    throw new Error(`sfdx auth:logout failed with error:\n${rv.stderr}`);
  }
}

describe('test sandbox clone command', () => {
  const env = new Env();
  let username: string;

  before(async () => {
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    const queryStr =
      "SELECT SandboxName FROM SandboxProcess WHERE Status != 'E' and Status != 'D' AND SourceId = '' ORDER BY CreatedDate DESC LIMIT 1";
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username }),
    });
    const queryResult = (await connection.tooling.query(queryStr)) as { records: SandboxProcessObject[] };
    expect(queryResult?.records?.length).to.equal(1);
    sourceSandboxName = queryResult?.records[0]?.SandboxName;
    session = await TestSession.create({
      project: {
        sourceDir: path.join(process.cwd(), 'test', 'nut', 'commands', 'force', 'org'),
      },
    });
  });

  afterEach(() => {
    unsetAlias();
    unsetConfig();
    deleteSandbox(username);
  });

  it('sandbox status command', async () => {
    clonedSandboxName = await randomSandboxName();
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:clone -t sandbox SandboxName=${clonedSandboxName} SourceSandboxName=${sourceSandboxName} -u ${username} --json -w 60`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput.result;
    expect(orgStatusResult).to.be.ok;
  });

  it('sandbox status command sets setdefaultusername', async () => {
    clonedSandboxName = await randomSandboxName();
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:clone -t sandbox SandboxName=${clonedSandboxName} SourceSandboxName=${sourceSandboxName} -u ${username} -s --json -w 60`,
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
    expect(result.stdout).to.contain(`"${username}.${clonedSandboxName}"`);
  });

  it('sandbox status command set alias', async () => {
    clonedSandboxName = await randomSandboxName();
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:clone -t sandbox SandboxName=${clonedSandboxName} SourceSandboxName=${sourceSandboxName} -u ${username} -a ${clonedSandboxName} --json -w 60`,
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
    expect(result.stdout).to.contain(`"${clonedSandboxName}"`);
  });

  after(async () => {
    await session.zip(undefined, 'artifacts');
    await session.clean();
  });
});
