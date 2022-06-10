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
import { isArray, AnyJson, ensureString } from '@salesforce/ts-types';

let session: TestSession;
let sandboxName: string;
let hubOrgUsername: string;

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
  before(async () => {
    session = await TestSession.create({
      setupCommands: ['sfdx config:get defaultdevhubusername --json'],
      project: {
        sourceDir: path.join(process.cwd(), 'test', 'nut', 'commands', 'force', 'org'),
      },
    });
    // get default devhub username
    if (isArray<AnyJson>(session.setup)) {
      hubOrgUsername = ensureString(
        (session.setup[0] as { result: [{ key: string; value: string }] }).result.find(
          (config) => config.key === 'defaultdevhubusername'
        )?.value
      );
    }
    const queryStr =
      "SELECT SandboxName FROM SandboxProcess WHERE Status != 'E' and Status != 'D' ORDER BY CreatedDate DESC LIMIT 1";
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username: hubOrgUsername }),
    });
    const queryResult = (await connection.tooling.query(queryStr)) as { records: SandboxProcessObject[] };
    expect(queryResult?.records?.length).to.equal(1);
    sandboxName = queryResult?.records[0]?.SandboxName;
  });

  afterEach(() => {
    unsetAlias();
    unsetConfig();
    logoutSandbox(hubOrgUsername);
  });

  it('sandbox status command', async () => {
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:status --sandboxname ${sandboxName} -u ${hubOrgUsername} --json`,
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
      `force:org:status --sandboxname ${sandboxName} -u ${hubOrgUsername} -s --json`,
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
    expect(result.stdout).to.contain(`"${hubOrgUsername}.${sandboxName}"`);
  });

  it('sandbox status command set alias', async () => {
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:status --sandboxname ${sandboxName} -u ${hubOrgUsername} -a ${sandboxName} --json`,
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
