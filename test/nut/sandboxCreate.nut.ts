/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import { assert, expect } from 'chai';
import sinon from 'sinon';
import { TestSession, genUniqueString } from '@salesforce/cli-plugins-testkit';
import { SandboxRequestCache } from '@salesforce/core';
import { stubSfCommandUx, stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import CreateSandbox from '../../src/commands/org/create/sandbox.js';
import {
  deleteSandboxCacheFile,
  getSandboxInfo,
  getSandboxProcess,
  getSandboxProcessSoql,
  readSandboxCacheFile,
  stubProdOrgConnection,
  stubToolingCreate,
  stubToolingQuery,
} from '../shared/sandboxMockUtils.js';

describe('Sandbox Create', () => {
  let session: TestSession;
  let hubOrgUsername: string;
  let cacheFilePath: string;
  let sandboxDefFilePath: string;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  const sinonSandbox = sinon.createSandbox();

  let sandboxProcessSoql: string;

  before(async () => {
    const uid = genUniqueString('sbxCreate_%s');
    session = await TestSession.create({
      project: { name: 'sandboxCreate' },
      devhubAuthStrategy: 'AUTH_URL',
      sessionDir: path.join(process.cwd(), `test_session_${uid}`),
    });
    assert(session.hubOrg.username);
    hubOrgUsername = session.hubOrg.username;
    cacheFilePath = path.join(session.dir, '.sf', SandboxRequestCache.getFileName());
    sandboxDefFilePath = path.join(session.project.dir, 'sandboxDef.json');

    // add a sandbox definition file to the project
    const { SandboxName, LicenseType, Id } = getSandboxInfo();
    sandboxProcessSoql = getSandboxProcessSoql({ sandboxInfoId: Id });
    fs.writeFileSync(sandboxDefFilePath, JSON.stringify({ SandboxName, LicenseType }));
  });

  beforeEach(() => {
    sfCommandUxStubs = stubSfCommandUx(sinonSandbox);
    stubUx(sinonSandbox);
    stubSpinner(sinonSandbox);
  });

  after(async () => {
    await session?.clean();
  });

  afterEach(() => {
    try {
      console.log('before deleting sandbox cache file');
      deleteSandboxCacheFile(cacheFilePath);
      console.log('after deleting sandbox cache file');
    } catch (err) {
      // ignore since there isn't always a cache file written
    }
    sinonSandbox.restore();
  });

  //
  // NOTE: These tests use stubbed server responses since sandbox refresh
  //       takes a very long time.
  // Stubs:
  //   1. Connection.singleRecordQuery - used to query for the SandboxInfo
  //   2. Connection.tooling.update - used to update the SandboxInfo
  //   3. Connection.tooling.query - used to query for the SandboxProcess
  //

  it('should return a SandboxProcessObject without polling (--async) using --name', async () => {
    const sbxInfo = getSandboxInfo();
    const sbxName = sbxInfo.SandboxName;
    const sbxLicenseType = 'Developer';
    const sbxProcess = getSandboxProcess();
    console.log('--- sandboxCreateNut test 1 ---');
    console.dir(sbxProcess, { depth: 8 });
    console.log('-------------------------------');
    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);

    const toolingCreateStub = stubToolingCreate({ sinonSandbox, connection });
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    const result = await CreateSandbox.run(['--name', sbxName, '-o', hubOrgUsername, '--async', '--json']);

    expect(result).to.deep.equal(sbxProcess);
    expect(toolingCreateStub.calledOnce, 'toolingCreateStub').to.be.true;
    expect(toolingCreateStub.firstCall.args[1]).to.deep.equal({
      SandboxName: sbxName,
      LicenseType: sbxLicenseType,
    });
    expect(toolingQueryStub.calledOnce, 'toolingQueryStub').to.be.true;

    // check the sandbox cache entry
    const cache = readSandboxCacheFile(cacheFilePath);
    console.log('--- sandboxCreateNut test 1 cacheFile ---');
    console.dir(cache, { depth: 8 });
    console.log('-------------------------------');
    expect(cache).to.have.property(sbxName);
    expect(cache[sbxName]).to.have.property('action', 'Create');
    expect(cache[sbxName]).to.have.property('prodOrgUsername', hubOrgUsername);
    expect(cache[sbxName]).to.have.deep.property('sandboxProcessObject', sbxProcess);
    expect(cache[sbxName]).to.have.deep.property('sandboxRequest', {
      SandboxName: sbxName,
      LicenseType: sbxLicenseType,
    });
    expect(sfCommandUxStubs).to.be.ok;
  });

  // This test uses a sandbox definition file and flags to override the name and LicenseType.
  it('should override existing SandboxInfo with definition-file values', async () => {
    const sbxName = 'OvrSbxName';
    const sbxLicenseType = 'Partial';
    const sbxProcess = getSandboxProcess({ SandboxName: sbxName, LicenseType: sbxLicenseType });
    console.log('--- sandboxCreateNut test 2 ---');
    console.dir(sbxProcess, { depth: 8 });
    console.log('-------------------------------');
    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);

    const toolingCreateStub = stubToolingCreate({ sinonSandbox, connection });
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    const result = await CreateSandbox.run([
      '--definition-file',
      sandboxDefFilePath,
      '--name',
      sbxName,
      '--license-type',
      sbxLicenseType,
      '-o',
      hubOrgUsername,
      '--async',
      '--json',
    ]);

    expect(result).to.deep.equal(sbxProcess);
    expect(toolingCreateStub.calledOnce).to.be.true;
    expect(toolingCreateStub.firstCall.args[1]).to.deep.equal({
      SandboxName: sbxName,
      LicenseType: sbxLicenseType,
    });
    expect(toolingQueryStub.calledOnce).to.be.true;

    // check the sandbox cache entry
    const cache = readSandboxCacheFile(cacheFilePath);
    console.log('--- sandboxCreateNut test 2 cacheFile ---');
    console.dir(cache, { depth: 8 });
    console.log('-------------------------------');
    expect(cache).to.have.property(sbxName);
    expect(cache[sbxName]).to.have.property('action', 'Create');
    expect(cache[sbxName]).to.have.property('prodOrgUsername', hubOrgUsername);
    expect(cache[sbxName]).to.have.deep.property('sandboxProcessObject', sbxProcess);
    expect(cache[sbxName]).to.have.deep.property('sandboxRequest', {
      SandboxName: sbxName,
      LicenseType: sbxLicenseType,
    });
  });
});
