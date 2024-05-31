/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, expect } from 'chai';
import sinon from 'sinon';
import { TestSession, genUniqueString } from '@salesforce/cli-plugins-testkit';
import { AuthInfo, Org, SandboxRequestCache } from '@salesforce/core';
import { stubSfCommandUx, stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import ResumeSandbox from '../../src/commands/org/resume/sandbox.js';
import {
  deleteSandboxCacheFile,
  getSandboxInfo,
  getSandboxProcess,
  getSandboxProcessSoql,
  readAuthFile,
  readSandboxCacheFile,
  stubProdOrgConnection,
  stubToolingQuery,
} from '../shared/sandboxMockUtils.js';

describe('Sandbox Resume', () => {
  let session: TestSession;
  let hubOrgUsername: string;
  let cacheFilePath: string;
  let sandboxDefFilePath: string;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  const sinonSandbox = sinon.createSandbox();

  before(async () => {
    const uid = genUniqueString('sbxResume_%s');
    session = await TestSession.create({
      project: { name: 'sandboxResume' },
      devhubAuthStrategy: 'AUTH_URL',
      sessionDir: path.join(process.cwd(), `test_session_${uid}`),
    });
    assert(session.hubOrg.username);
    hubOrgUsername = session.hubOrg.username;
    cacheFilePath = path.join(session.dir, '.sf', SandboxRequestCache.getFileName());
    sandboxDefFilePath = path.join(session.project.dir, 'sandboxDef.json');

    // add a sandbox definition file to the project
    const { SandboxName, LicenseType } = getSandboxInfo();
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
      deleteSandboxCacheFile(cacheFilePath);
    } catch (err) {
      // ignore since there isn't always a cache file written
    }
    sinonSandbox.restore();
  });

  //
  // NOTE: These tests use stubbed server responses since sandbox resume
  //       takes a very long time.
  // Stubs:
  //   1. Connection.singleRecordQuery - used to query for the SandboxInfo
  //   2. Connection.tooling.update - used to update the SandboxInfo
  //   3. Connection.tooling.query - used to query for the SandboxProcess
  //

  it('should return a SandboxProcessObject without polling using --name', async () => {
    const sbxName = 'resumeSbx1';
    const sbxProcess = getSandboxProcess({ SandboxName: sbxName });
    const sandboxProcessSoql = getSandboxProcessSoql({ SandboxName: sbxName });

    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    const result = await ResumeSandbox.run(['--name', sbxName, '-o', hubOrgUsername, '--json']);

    expect(result).to.deep.equal(sbxProcess);
    expect(toolingQueryStub.calledOnce, 'toolingQueryStub').to.be.true;

    // check the sandbox cache entry
    const cache = readSandboxCacheFile(cacheFilePath);
    expect(cache).to.have.property(sbxName);
    expect(cache[sbxName]).to.have.property('action', 'Create');
    expect(cache[sbxName]).to.have.property('prodOrgUsername', hubOrgUsername);
    expect(cache[sbxName]).to.have.deep.property('sandboxProcessObject', sbxProcess);
    expect(cache[sbxName]).to.have.deep.property('sandboxRequest', {});
    expect(sfCommandUxStubs).to.be.ok;
  });

  it('should return a SandboxProcessObject without polling using --job-id', async () => {
    const sbxName = 'resumeSbx2';
    const sbxProcess = getSandboxProcess({ SandboxName: sbxName });
    const sandboxProcessSoql = getSandboxProcessSoql({ Id: sbxProcess.Id });

    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    const result = await ResumeSandbox.run(['--job-id', sbxProcess.Id, '-o', hubOrgUsername, '--json']);

    expect(result).to.deep.equal(sbxProcess);
    expect(toolingQueryStub.calledOnce, 'toolingQueryStub').to.be.true;

    // check the sandbox cache entry
    const cache = readSandboxCacheFile(cacheFilePath);
    expect(cache).to.have.property(sbxName);
    expect(cache[sbxName]).to.have.property('action', 'Create');
    expect(cache[sbxName]).to.have.property('prodOrgUsername', hubOrgUsername);
    expect(cache[sbxName]).to.have.deep.property('sandboxProcessObject', sbxProcess);
    expect(cache[sbxName]).to.have.deep.property('sandboxRequest', {});
    expect(sfCommandUxStubs).to.be.ok;
  });

  it('should return a complete SandboxProcessObject when polling using --job-id', async () => {
    const sbxName = 'resumeSbx3';
    const sbxProcess = getSandboxProcess({ SandboxName: sbxName });
    const completeSbxProcess = getSandboxProcess({
      SandboxName: sbxName,
      Status: 'Completed',
      CopyProgress: 100,
      EndDate: '2024-02-22T00:37:46.000+0000',
    });
    const expectedCmdResponse = { ...completeSbxProcess, SandboxUsername: `${hubOrgUsername}.${sbxName}` };

    // This call is used in polling; Org.pollStatusAndAuth()
    const querySandboxProcessByIdStub = sinonSandbox
      .stub(Org.prototype, 'querySandboxProcessById')
      .withArgs(sbxProcess.Id)
      .resolves(completeSbxProcess);

    const sbxAuthResponse = {
      authUserName: `${hubOrgUsername}.${sbxName}`,
      authCode: '1qa2ws3ed4rf',
      instanceUrl: `https://sf0927--${sbxName}.sandbox.my.salesforce.com`,
      loginUrl: 'https://test.salesforce.com',
    };
    // This call is to auth a completed sandbox refresh
    const sandboxSignupCompleteStub = sinonSandbox
      // @ts-expect-error stubbing private function
      .stub(Org.prototype, 'sandboxSignupComplete')
      .resolves(sbxAuthResponse);

    // Stub AuthInfo functions so an auth file is written without making http calls
    // @ts-expect-error stubbing private function
    const authInfoExchangeTokenStub = sinonSandbox.stub(AuthInfo.prototype, 'exchangeToken').resolves({
      username: sbxAuthResponse.authUserName,
      parentUsername: hubOrgUsername,
      instanceUrl: sbxAuthResponse.instanceUrl,
      loginUrl: sbxAuthResponse.loginUrl,
      accessToken: 'fake-access-token-1234',
      orgId: sbxProcess.SandboxOrganization,
    });
    // @ts-expect-error stubbing private function
    sinonSandbox.stub(AuthInfo.prototype, 'determineIfDevHub').resolves(false);
    // @ts-expect-error stubbing private function
    sinonSandbox.stub(AuthInfo.prototype, 'getNamespacePrefix').resolves();

    const result = await ResumeSandbox.run(['--job-id', sbxProcess.Id, '-o', hubOrgUsername, '--wait', '1', '--json']);

    // result will be the last SandboxProcess
    expect(result, 'checking result').to.deep.equal(expectedCmdResponse);
    // expect(toolingQueryStub.calledOnce, 'toolingQueryStub called').to.be.true;
    expect(querySandboxProcessByIdStub.called, 'querySandboxProcessByIdStub called').to.be.true;
    expect(sandboxSignupCompleteStub.called, 'sandboxSignupCompleteStub called').to.be.true;
    expect(authInfoExchangeTokenStub.called, 'authInfoExchangeTokenStub called').to.be.true;

    // Check auth files exist
    const authFileContents = readAuthFile(session.homeDir, sbxAuthResponse.authUserName);
    expect(authFileContents).to.be.ok;
    expect(authFileContents).to.have.property('username', sbxAuthResponse.authUserName);
    expect(authFileContents).to.have.property('parentUsername', hubOrgUsername);
    expect(authFileContents).to.have.property('accessToken');
    expect(authFileContents).to.have.property('isSandbox', true);
    expect(authFileContents).to.not.have.property('authCode');

    // check sandbox auth file doesn't exist
    try {
      readSandboxCacheFile(cacheFilePath);
      assert(false, 'should not have found a sandbox cache file');
    } catch (err) {
      // ignore
    }
  });
});
