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
import { Org, SandboxProcessObject, SandboxRequestCache, SfError, Messages, AuthInfo } from '@salesforce/core';
import { stubSfCommandUx, stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import RefreshSandbox from '../../src/commands/org/refresh/sandbox.js';
import {
  deleteSandboxCacheFile,
  getSandboxInfo,
  getSandboxProcess,
  getSandboxInfoSoql,
  getSandboxProcessSoql,
  readAuthFile,
  readSandboxCacheFile,
  stubProdOrgConnection,
  stubSingleRecordQuery,
  stubToolingUpdate,
  stubToolingQuery,
} from '../shared/sandboxMockUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'sandboxbase');

describe('Sandbox Refresh', () => {
  let session: TestSession;
  let hubOrgUsername: string;
  let cacheFilePath: string;
  let sandboxDefFilePath: string;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  const sinonSandbox = sinon.createSandbox();

  const sandboxInfoSoql = getSandboxInfoSoql();
  const sandboxProcessSoql = getSandboxProcessSoql();

  before(async () => {
    const uid = genUniqueString('sbxRefresh_%s');
    session = await TestSession.create({
      project: { name: 'sandboxRefresh' },
      devhubAuthStrategy: 'AUTO',
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
    const sbxProcess = getSandboxProcess();
    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);

    const singleRecordQueryStub = stubSingleRecordQuery({ sinonSandbox, connection, sandboxInfoSoql, sbxInfo });
    const toolingUpdateStub = stubToolingUpdate({ sinonSandbox, connection });
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    const result: SandboxProcessObject = await RefreshSandbox.run([
      '--name',
      sbxName,
      '-o',
      hubOrgUsername,
      '--async',
      '--json',
    ]);

    expect(result).to.deep.equal(sbxProcess);
    expect(singleRecordQueryStub.calledOnce).to.be.true;
    expect(toolingUpdateStub.calledOnce).to.be.true;
    expect(toolingQueryStub.calledOnce).to.be.true;

    // check the sandbox cache entry
    const cache = readSandboxCacheFile(cacheFilePath);
    expect(cache).to.have.property(sbxName);
    expect(cache[sbxName]).to.have.property('action', 'Refresh');
    expect(cache[sbxName]).to.have.property('prodOrgUsername', hubOrgUsername);
    expect(cache[sbxName]).to.have.deep.property('sandboxProcessObject', sbxProcess);
    expect(cache[sbxName]).to.have.deep.property('sandboxRequest', sbxInfo);
  });

  // This test uses a sandbox definition file to override the LicenseType from
  // DEVELOPER_PRO to DEVELOPER.
  it('should override existing SandboxInfo with definition-file values', async () => {
    const sbxInfo = getSandboxInfo({ LicenseType: 'DEVELOPER PRO' });
    const sbxName = sbxInfo.SandboxName;
    const sbxProcess = getSandboxProcess();
    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);

    const singleRecordQueryStub = stubSingleRecordQuery({ sinonSandbox, connection, sandboxInfoSoql, sbxInfo });
    const toolingUpdateStub = stubToolingUpdate({ sinonSandbox, connection });
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    const result: SandboxProcessObject = await RefreshSandbox.run([
      '--definition-file',
      sandboxDefFilePath,
      '-o',
      hubOrgUsername,
      '--async',
      '--json',
    ]);

    expect(result).to.deep.equal(sbxProcess);
    expect(singleRecordQueryStub.calledOnce).to.be.true;
    expect(toolingUpdateStub.calledOnce).to.be.true;
    const { Id, SandboxName, LicenseType, HistoryDays, CopyChatter, AutoActivate } = getSandboxInfo();
    expect(toolingUpdateStub.firstCall.args[1]).to.deep.equal({
      Id,
      SandboxName,
      LicenseType,
      HistoryDays,
      CopyChatter,
      AutoActivate,
    });
    expect(toolingQueryStub.calledOnce).to.be.true;

    // check the sandbox cache entry
    const cache = readSandboxCacheFile(cacheFilePath);
    expect(cache).to.have.property(sbxName);
    expect(cache[sbxName]).to.have.property('action', 'Refresh');
    expect(cache[sbxName]).to.have.property('prodOrgUsername', hubOrgUsername);
    expect(cache[sbxName]).to.have.deep.property('sandboxProcessObject', sbxProcess);
    expect(cache[sbxName]).to.have.deep.property('sandboxRequest', getSandboxInfo());
  });

  it('should error when no sandbox name provided', async () => {
    try {
      await RefreshSandbox.run(['-o', hubOrgUsername, '--async', '--json']);
      assert(false, 'Expected RefreshSandbox to throw NoSandboxNameError');
    } catch (e) {
      assert(e instanceof SfError, 'Expect error to be an instance of SfError');
      expect(e.name).to.equal('NoSandboxNameError');
      expect(e.message).to.equal('Must specify a sandbox name using the `--name` or `--definition-file` flag.');
    }
  });

  it('should error when no SandboxInfo found', async () => {
    const sbxInfo = getSandboxInfo();
    const sbxName = sbxInfo.SandboxName;
    const sbxProcess = getSandboxProcess();
    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);

    const noRecordsError = new Error('no SandboxInfo records');
    noRecordsError.name = 'SingleRecordQuery_NoRecords';
    const singleRecordQueryStub = sinonSandbox
      .stub(connection, 'singleRecordQuery')
      .withArgs(sandboxInfoSoql, { tooling: true })
      .throws(noRecordsError);
    const toolingUpdateStub = stubToolingUpdate({ sinonSandbox, connection });
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    try {
      await RefreshSandbox.run(['--name', sbxName, '-o', hubOrgUsername, '--async', '--json']);
      assert(false, 'Expected SandboxNotFoundError');
    } catch (e) {
      assert(e instanceof SfError, 'Expect error to be an instance of SfError');
      expect(e.name).to.equal('SandboxNotFoundError');
      expect(e.message).to.equal(
        `The sandbox name "${sbxName}" could not be found in production org "${hubOrgUsername}".`
      );
    }
    expect(singleRecordQueryStub.called).to.be.true;
    expect(toolingUpdateStub.called).to.be.false;
    expect(toolingQueryStub.called).to.be.false;
  });

  it('should set AutoActivate to false on SandboxInfo with --no-auto-activate flag', async () => {
    const sbxInfo = getSandboxInfo();
    const sbxName = sbxInfo.SandboxName;
    const sbxProcess = getSandboxProcess();
    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);

    const singleRecordQueryStub = stubSingleRecordQuery({ sinonSandbox, connection, sandboxInfoSoql, sbxInfo });
    const toolingUpdateStub = stubToolingUpdate({ sinonSandbox, connection });
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    const result: SandboxProcessObject = await RefreshSandbox.run([
      '--name',
      sbxName,
      '-o',
      hubOrgUsername,
      '--no-auto-activate',
      '--async',
      '--json',
    ]);

    expect(result).to.deep.equal(sbxProcess);
    expect(singleRecordQueryStub.calledOnce).to.be.true;
    expect(toolingUpdateStub.calledOnce).to.be.true;
    const sbxInfoNoAutoActivate = getSandboxInfo({ AutoActivate: false });
    const { Id, SandboxName, LicenseType, HistoryDays, CopyChatter, AutoActivate } = sbxInfoNoAutoActivate;
    expect(toolingUpdateStub.firstCall.args[1]).to.deep.equal({
      Id,
      SandboxName,
      LicenseType,
      HistoryDays,
      CopyChatter,
      AutoActivate,
    });
    expect(toolingQueryStub.calledOnce).to.be.true;

    // check the sandbox cache entry
    const cache = readSandboxCacheFile(cacheFilePath);
    expect(cache).to.have.property(sbxName);
    expect(cache[sbxName]).to.have.property('action', 'Refresh');
    expect(cache[sbxName]).to.have.property('prodOrgUsername', hubOrgUsername);
    expect(cache[sbxName]).to.have.deep.property('sandboxProcessObject', sbxProcess);
    expect(cache[sbxName]).to.have.deep.property('sandboxRequest', sbxInfoNoAutoActivate);
  });

  it('should poll and report a timeout', async () => {
    const sbxInfo = getSandboxInfo();
    const sbxName = sbxInfo.SandboxName;
    const sbxProcess = getSandboxProcess();
    const updatedSbxProcess = getSandboxProcess({ Status: 'Processing', CopyProgress: 90 });
    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);

    const singleRecordQueryStub = stubSingleRecordQuery({ sinonSandbox, connection, sandboxInfoSoql, sbxInfo });
    const toolingUpdateStub = stubToolingUpdate({ sinonSandbox, connection });
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

    // This call is used in polling; Org.pollStatusAndAuth()
    const querySandboxProcessByIdStub = sinonSandbox
      .stub(Org.prototype, 'querySandboxProcessById')
      .withArgs(sbxProcess.Id)
      .resolves(updatedSbxProcess);

    const result: SandboxProcessObject = await RefreshSandbox.run([
      '--name',
      sbxName,
      '-o',
      hubOrgUsername,
      '--no-prompt',
      '--wait',
      '1', // wait for 1 min
      '--poll-interval',
      '20', // poll every 20s
    ]);

    // result will be the last SandboxProcess
    expect(result, 'checking result').to.deep.equal(updatedSbxProcess);
    expect(singleRecordQueryStub.calledOnce).to.be.true;
    expect(toolingUpdateStub.calledOnce).to.be.true;
    expect(toolingQueryStub.calledOnce).to.be.true;
    expect(querySandboxProcessByIdStub.callCount).to.be.greaterThan(2);

    // check the sandbox cache entry
    const cache = readSandboxCacheFile(cacheFilePath);
    expect(cache).to.have.property(sbxName);
    expect(cache[sbxName]).to.have.property('action', 'Refresh');
    expect(cache[sbxName]).to.have.property('prodOrgUsername', hubOrgUsername);
    expect(cache[sbxName]).to.have.deep.property('sandboxProcessObject', updatedSbxProcess);
    expect(cache[sbxName]).to.have.deep.property('sandboxRequest', sbxInfo);

    // check the command output for the `org resume sandbox` suggestion
    expect(sfCommandUxStubs.warn.called).to.be.true;
    const timeoutMsg = messages.getMessage('warning.ClientTimeoutWaitingForSandboxProcess', ['refresh']);
    expect(sfCommandUxStubs.warn.firstCall.args[0]).to.equal(timeoutMsg);
    expect(sfCommandUxStubs.info.called).to.be.true;
    const sbxStatusMsg = messages.getMessage('checkSandboxStatus', ['mocha', updatedSbxProcess.Id, hubOrgUsername]);
    expect(sfCommandUxStubs.info.firstCall.args[0]).to.equal(sbxStatusMsg);
  });

  it('should poll and report a success and write an auth file', async () => {
    const sbxInfo = getSandboxInfo();
    const sbxName = sbxInfo.SandboxName;
    const sbxProcess = getSandboxProcess();
    const completeSbxProcess = getSandboxProcess({
      Status: 'Completed',
      CopyProgress: 100,
      EndDate: '2024-02-22T00:37:46.000+0000',
    });
    const connection = await stubProdOrgConnection(sinonSandbox, hubOrgUsername);

    const singleRecordQueryStub = stubSingleRecordQuery({ sinonSandbox, connection, sandboxInfoSoql, sbxInfo });
    const toolingUpdateStub = stubToolingUpdate({ sinonSandbox, connection });
    const toolingQueryStub = stubToolingQuery({ sinonSandbox, connection, sandboxProcessSoql, sbxProcess });

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

    const result: SandboxProcessObject = await RefreshSandbox.run([
      '--name',
      sbxName,
      '-o',
      hubOrgUsername,
      '--no-prompt',
      '--wait',
      '1', // wait for 1 min
      '--poll-interval',
      '20', // poll every 20s
    ]);

    // result will be the last SandboxProcess
    expect(result, 'checking result').to.deep.equal(completeSbxProcess);
    expect(singleRecordQueryStub.calledOnce, 'singleRecordQueryStub called').to.be.true;
    expect(toolingUpdateStub.calledOnce, 'toolingUpdateStub called').to.be.true;
    expect(toolingQueryStub.calledOnce, 'toolingQueryStub called').to.be.true;
    expect(querySandboxProcessByIdStub.called, 'querySandboxProcessByIdStub called').to.be.true;
    expect(sandboxSignupCompleteStub.called, 'sandboxSignupCompleteStub called').to.be.true;
    // expect(authInfoExchangeTokenStub.called, 'authInfoExchangeTokenStub called').to.be.true;
    // eslint-disable-next-line no-console
    console.dir(authInfoExchangeTokenStub, { depth: 8 });

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
