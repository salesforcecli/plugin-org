/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { assert, expect } from 'chai';
import {
  // Org,
  MyDomainResolver,
  Messages,
} from '@salesforce/core';
import { Config } from '@oclif/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { MockTestOrgData, TestContext, shouldThrow } from '@salesforce/core/lib/testSetup';
import * as utils from '../../../../src/shared/utils';
import { OrgOpenCommand, OrgOpenOutput } from '../../../../src/commands/force/org/open';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');

describe('open commands', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  const testBrowser = 'firefox';
  const testPath = '/lightning/whatever';
  const expectedDefaultUrl = `${testOrg.instanceUrl}/secur/frontdoor.jsp?sid=${testOrg.accessToken}`;
  const expectedUrl = `${expectedDefaultUrl}&retURL=${encodeURIComponent(testPath)}`;

  const testJsonStructure = (response: OrgOpenOutput) => {
    expect(response).to.have.property('url');
    expect(response).to.have.property('username').equal(testOrg.username);
    expect(response).to.have.property('orgId').equal(testOrg.orgId);
  };

  const spies = new Map();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    spies.set('open', stubMethod($$.SANDBOX, utils, 'openUrl').resolves());
  });

  afterEach(() => {
    spies.clear();
    $$.restore();
  });

  describe('url generation', () => {
    it('org without a url defaults to proper default', async () => {
      const cmd = new OrgOpenCommand(['--json', '--targetusername', testOrg.username, '--urlonly'], {} as Config);
      const response = await cmd.run();
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedDefaultUrl);
    });

    it('org with a url is built correctly', async () => {
      const cmd = new OrgOpenCommand(
        ['--json', '--targetusername', testOrg.username, '--urlonly', '--path', testPath],
        {} as Config
      );
      const response = await cmd.run();
      assert(response);
      expect(response.url).to.equal(expectedUrl);
    });

    it('can read url from env', async () => {
      process.env.FORCE_OPEN_URL = testPath;

      const cmd = new OrgOpenCommand(['--json', '--targetusername', testOrg.username, '--urlonly'], {} as Config);
      const response = await cmd.run();
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedUrl);
      delete process.env.FORCE_OPEN_URL;
    });
  });

  describe('domain resolution, with callout', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, MyDomainResolver, 'create').resolves(MyDomainResolver.prototype);
    });

    it('waits on domains that need time to resolve', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));

      const cmd = new OrgOpenCommand(
        ['--json', '--targetusername', testOrg.username, '--path', testPath],
        {} as Config
      );
      const response = await cmd.run();
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedUrl);

      expect(spies.get('resolver').callCount).to.equal(1);
    });

    it('handles domain timeouts', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').throws(new Error('timeout')));
      const cmd = new OrgOpenCommand(
        ['--json', '--targetusername', testOrg.username, '--path', testPath],
        {} as Config
      );
      try {
        await cmd.run();
      } catch (e) {
        expect(spies.get('resolver').callCount).to.equal(1);
        expect(spies.get('open').callCount).to.equal(0);
        assert(e instanceof Error);
        expect(e.message).to.equal(messages.getMessage('domainTimeoutError'));
      }
    });
  });

  describe('domain resolution, no callout', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, MyDomainResolver, 'create').resolves(MyDomainResolver.prototype);
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));
    });
    // it('does not wait for domains on internal urls');

    it('does not wait for domains in container mode, even without urlonly', async () => {
      process.env.SFDX_CONTAINER_MODE = 'true';
      const cmd = new OrgOpenCommand(
        ['--json', '--targetusername', testOrg.username, '--path', testPath],
        {} as Config
      );
      const response = await cmd.run();
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedUrl);
      expect(spies.get('resolver').callCount).to.equal(0);
      delete process.env.SFDX_CONTAINER_MODE;
    });

    it('does not wait for domains when timeouts are zero, even without urlonly', async () => {
      process.env.SFDX_DOMAIN_RETRY = '0';

      const cmd = new OrgOpenCommand(
        ['--json', '--targetusername', testOrg.username, '--path', testPath],
        {} as Config
      );
      const response = await cmd.run();
      assert(response);
      testJsonStructure(response);
      expect(spies.get('resolver').callCount).to.equal(0);
      delete process.env.SFDX_DOMAIN_RETRY;
    });
  });

  describe('human output', () => {
    let stdoutSpy: sinon.SinonSpy;

    beforeEach(() => {
      stubMethod($$.SANDBOX, MyDomainResolver, 'create').resolves(MyDomainResolver.prototype);
      stdoutSpy = $$.SANDBOX.stub(process.stdout, 'write');
    });

    it('calls open and outputs proper success message (no url)', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));
      const cmd = new OrgOpenCommand(['--targetusername', testOrg.username, '--path', testPath], {} as Config);
      $$.SANDBOX.stub(cmd.spinner, 'start').returns();

      await cmd.run();

      const stdoutResult = stdoutSpy.args.flat().join('');

      expect(stdoutResult).to.include(messages.getMessage('humanSuccessNoUrl', [testOrg.orgId, testOrg.username]));
      expect(spies.get('resolver').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
    });

    it('outputs proper warning and message (includes url for --urlonly)', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));

      const cmd = new OrgOpenCommand(
        ['--targetusername', testOrg.username, '--path', testPath, '--urlonly'],
        {} as Config
      );
      $$.SANDBOX.stub(cmd.spinner, 'start').returns();

      await cmd.run();
      const stdoutResult = stdoutSpy.args.flat().join('');

      expect(stdoutResult).to.include(
        messages.getMessage('humanSuccess', [testOrg.orgId, testOrg.username, expectedUrl])
      );
    });

    it('throws on dns fail', async () => {
      spies.set(
        'resolver',
        stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').rejects(new Error('timeout'))
      );
      const cmd = new OrgOpenCommand(['--targetusername', testOrg.username, '--path', testPath], {} as Config);
      $$.SANDBOX.stub(cmd.spinner, 'start').returns();

      try {
        await shouldThrow(cmd.run());
      } catch (e) {
        assert(e instanceof Error);
        expect(e.message).to.contain(messages.getMessage('domainTimeoutError'));
        expect(spies.get('resolver').callCount).to.equal(1);
        expect(spies.get('open').callCount).to.equal(0);
      }
    });
  });

  describe('browser argument', () => {
    it('calls open with no browser argument', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));
      const cmd = new OrgOpenCommand(['--targetusername', testOrg.username, '--path', testPath], {} as Config);
      const warnSpy = $$.SANDBOX.stub(cmd, 'warn');
      const successSpy = $$.SANDBOX.stub(cmd, 'logSuccess');
      $$.SANDBOX.stub(cmd.spinner, 'start').returns();

      await cmd.run();
      expect(
        successSpy.calledOnceWith(
          messages.getMessage('humanSuccessNoUrl', [testOrg.orgId, testOrg.username, expectedUrl])
        )
      );
      expect(warnSpy.calledOnceWith(sharedMessages.getMessage('SecurityWarning')));

      expect(spies.get('resolver').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.eql({});
    });

    it('calls open with a browser argument', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));

      const cmd = new OrgOpenCommand(
        ['--targetusername', testOrg.username, '--path', testPath, '-b', testBrowser],
        {} as Config
      );
      $$.SANDBOX.stub(cmd.spinner, 'start').returns();
      const warnSpy = $$.SANDBOX.stub(cmd, 'warn');
      const successSpy = $$.SANDBOX.stub(cmd, 'logSuccess');

      await cmd.run();
      expect(warnSpy.calledOnceWith(sharedMessages.getMessage('SecurityWarning')));
      expect(
        successSpy.calledOnceWith(
          messages.getMessage('humanSuccessNoUrl', [testOrg.orgId, testOrg.username, expectedUrl])
        )
      );

      expect(spies.get('resolver').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.not.eql({});
    });

    it('does not call open as passed unknown browser name', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));

      const cmd = new OrgOpenCommand(
        ['--targetusername', testOrg.username, '--path', testPath, '-b', 'duff'],
        {} as Config
      );
      $$.SANDBOX.stub(cmd.spinner, 'start').returns();

      try {
        await shouldThrow(cmd.run());
      } catch (e) {
        // as expected
      }
      expect(spies.get('resolver').callCount).to.equal(0);
      expect(spies.get('open').callCount).to.equal(0);
    });
  });
});
