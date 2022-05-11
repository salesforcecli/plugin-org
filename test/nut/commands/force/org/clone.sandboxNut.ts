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
let sourceSandboxInfoId: string;
let clonedSandboxName: string;

async function getConnection() {
  const env = new Env();
  const username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
  try {
    return await Connection.create({
      authInfo: await AuthInfo.create({ username }),
    });
  } catch (err) {
    throw new Error(`AuthInfo.create failed with error:\n${(err as Error).message}`);
  }
}

async function toolingQuery<T>(queryStr: string) {
  const connection = await getConnection();
  try {
    return (await connection.tooling.query(queryStr)) as { records: T[] };
  } catch (err) {
    throw new Error(`tooling.query failed with error:\n${(err as Error).message}`);
  }
}

async function getRandomSandboxName() {
  const connection = await getConnection();
  let sandboxName: string;
  let queryResult: { records: SandboxProcessObject[] };
  // Make sure there are no duplicate sandbox names
  while (queryResult?.records?.length !== 1) {
    sandboxName = `sbx${Array(7)
      .fill(0)
      .map(() => Math.random().toString(36).charAt(2))
      .join('')}`;
    const queryStr = `SELECT SandboxName FROM SandboxProcess WHERE SandboxName = ${sandboxName} ORDER BY CreatedDate DESC LIMIT 1`;
    queryResult = (await connection.tooling.query(queryStr)) as { records: SandboxProcessObject[] };
  }
  return sandboxName;
}

async function isSandboxClone(sandboxName: string, orgSourceId: string) {
  const queryStr = `SELECT SourceId, SandboxName FROM SandboxProcess WHERE SandboxName = ${sandboxName} AND SourceId = ${orgSourceId} ORDER BY CreatedDate DESC LIMIT 1`;
  try {
    return (await toolingQuery<SandboxProcessObject[]>(queryStr))?.records?.length === 1;
  } catch {
    return false;
  }
}

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
  let username: string;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: path.join(process.cwd(), 'test', 'nut', 'commands', 'force', 'org'),
      },
    });
    const queryStr =
      "SELECT SandboxInfoId, SandboxName FROM SandboxProcess WHERE Status != 'E' and Status != 'D' AND SourceId = '' ORDER BY CreatedDate DESC LIMIT 1";
    const queryResult = await toolingQuery<SandboxProcessObject>(queryStr);
    expect(queryResult?.records?.length).to.equal(1);
    sourceSandboxName = queryResult?.records[0]?.SandboxName;
    sourceSandboxInfoId = queryResult?.records[0]?.SandboxInfoId;
  });

  afterEach(() => {
    unsetAlias();
    unsetConfig();
    deleteSandbox(username);
  });

  it('sandbox status command', async () => {
    clonedSandboxName = await getRandomSandboxName();
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:clone -t sandbox SandboxName=${clonedSandboxName} SourceSandboxName=${sourceSandboxName} -u ${username} --json -w 60`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput.result;
    expect(orgStatusResult).to.be.ok;
    expect(isSandboxClone(clonedSandboxName, sourceSandboxInfoId)).to.be.true;
  });

  it('sandbox status command sets setdefaultusername', async () => {
    clonedSandboxName = await getRandomSandboxName();
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:clone -t sandbox SandboxName=${clonedSandboxName} SourceSandboxName=${sourceSandboxName} -u ${username} -s --json -w 60`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput.result;
    expect(orgStatusResult).to.be.ok;
    expect(isSandboxClone(clonedSandboxName, sourceSandboxInfoId)).to.be.true;
    const execOptions: shell.ExecOptions = {
      silent: true,
    };
    const result = shell.exec('sfdx config:get defaultusername --json', execOptions) as shell.ShellString;
    expect(result.code).to.equal(0);
    expect(result.stdout).to.contain(`"${username}.${clonedSandboxName}"`);
  });

  it('sandbox status command set alias', async () => {
    clonedSandboxName = await getRandomSandboxName();
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:clone -t sandbox SandboxName=${clonedSandboxName} SourceSandboxName=${sourceSandboxName} -u ${username} -a ${clonedSandboxName} --json -w 60`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput.result;
    expect(orgStatusResult).to.be.ok;
    expect(isSandboxClone(clonedSandboxName, sourceSandboxInfoId)).to.be.true;
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
