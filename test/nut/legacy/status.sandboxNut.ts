/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { assert, config, expect } from 'chai';
import * as shell from 'shelljs';
import { AuthInfo, Connection, SandboxProcessObject } from '@salesforce/core';

let session: TestSession;
let sandboxName: string;
let hubOrgUsername: string;
config.truncateThreshold = 0;

function unsetAlias() {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  shell.exec(`sf alias:unset ${sandboxName}`, execOptions) as shell.ShellString;
}

function unsetConfig() {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  shell.exec('sf config:unset defaultusername -g', execOptions) as shell.ShellString;
}

function logoutSandbox(username: string) {
  const execOptions: shell.ExecOptions = {
    silent: true,
  };
  const rv = shell.exec(`sf auth:logout -u ${username}.${sandboxName} --noprompt`, execOptions) as shell.ShellString;
  if (rv.code !== 0) {
    throw new Error(`sf auth:logout failed with error:\n${rv.stderr}`);
  }
}

describe('test sandbox status command', () => {
  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'legacy-sandbox-nut',
      },
      devhubAuthStrategy: 'AUTO',
    });
    assert(session.hubOrg.username);
    hubOrgUsername = session.hubOrg.username;
    // use ascending to avoid looking at recent sandboxes from other NUTs because they be might be deleted while this test is running
    const queryStr =
      "SELECT SandboxName FROM SandboxProcess WHERE Status != 'E' and Status != 'D' ORDER BY CreatedDate ASC LIMIT 1";

    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username: session.hubOrg.username }),
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

  it('sandbox status command', () => {
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:status --sandboxname ${sandboxName} -u ${hubOrgUsername} --json`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput?.result;
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

  it('sandbox status command sets setdefaultusername', () => {
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:status --sandboxname ${sandboxName} -u ${hubOrgUsername} -s --json`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput?.result;
    expect(orgStatusResult).to.be.ok;
    const execOptions: shell.ExecOptions = {
      silent: true,
    };
    const result = shell.exec('sf config:get defaultusername --json', execOptions) as shell.ShellString;
    expect(result.code).to.equal(0);
    expect(result.stdout).to.contain(`"${hubOrgUsername}.${sandboxName.toLowerCase()}"`);
  });

  it('sandbox status command set alias', () => {
    const orgStatusResult = execCmd<SandboxProcessObject>(
      `force:org:status --sandboxname ${sandboxName} -u ${hubOrgUsername} -a ${sandboxName} --json`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput?.result;
    expect(orgStatusResult).to.be.ok;
    const execOptions: shell.ExecOptions = {
      silent: true,
    };
    const result = shell.exec('sf alias:list --json', execOptions) as shell.ShellString;
    expect(result.code).to.equal(0);
    expect(result.stdout).to.contain(`"${sandboxName}"`);
  });

  after(async () => {
    await session?.zip(undefined, 'artifacts');
    await session?.clean();
  });
});
