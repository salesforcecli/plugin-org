/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';
import { join } from 'node:path';
import { assert, expect } from 'chai';
import { MyDomainResolver, Messages, Connection, SfError } from '@salesforce/core';
import { Config } from '@oclif/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { MockTestOrgData, shouldThrow, TestContext } from '@salesforce/core/lib/testSetup.js';
import { stubSfCommandUx, stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import { OrgOpenCommand, OrgOpenOutput } from '../../../src/commands/org/open.js';
import utils from '../../../src/shared/utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');

describe('org:open', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  const testBrowser = 'firefox';
  const testPath = '/lightning/whatever';
  const expectedDefaultUrl = `${testOrg.instanceUrl}/secur/frontdoor.jsp?sid=${testOrg.accessToken}`;
  const expectedUrl = `${expectedDefaultUrl}&retURL=${encodeURIComponent(testPath)}`;

  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  const testJsonStructure = (response: OrgOpenOutput) => {
    expect(response).to.have.property('url');
    expect(response).to.have.property('username').equal(testOrg.username);
    expect(response).to.have.property('orgId').equal(testOrg.orgId);
  };

  const spies = new Map();

  beforeEach(async () => {
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
    stubUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    await $$.stubAuths(testOrg);
    spies.set('open', stubMethod($$.SANDBOX, utils, 'openUrl').resolves());
  });

  afterEach(() => {
    spies.clear();
  });

  describe('url generation', () => {
    it('org without a url defaults to proper default', async () => {
      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--urlonly']);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedDefaultUrl);
    });

    it('org with a url is built correctly', async () => {
      const response = await OrgOpenCommand.run([
        '--json',
        '--targetusername',
        testOrg.username,
        '--urlonly',
        '--path',
        testPath,
      ]);
      assert(response);
      expect(response.url).to.equal(expectedUrl);
    });

    describe('--source-file', () => {
      const flexipagesDir = join('force-app', 'main', 'default', 'flexipages');
      const flexipagePath = join(flexipagesDir, 'test.flexipage-meta.xml');
      const apexDir = join('force-app', 'main', 'default', 'pages');
      const apexPath = join(apexDir, 'test.page');

      before(() => {
        fs.mkdirSync(flexipagesDir, { recursive: true });
        fs.writeFileSync(
          flexipagePath,
          '<?xml version="1.0" encoding="UTF-8" ?><FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata"></FlexiPage>'
        );

        fs.mkdirSync(apexDir, { recursive: true });
        fs.writeFileSync(
          apexPath,
          '<?xml version="1.0" encoding="UTF-8" ?><ApexPage xmlns="http://soap.sforce.com/2006/04/metadata"></ApexPage>'
        );
      });

      after(() => {
        fs.rmSync(flexipagesDir, { force: true, recursive: true });
        fs.rmSync(apexDir, { force: true, recursive: true });
      });

      it('--source-file to flexipage', async () => {
        const cmd = new OrgOpenCommand(
          ['--json', '--targetusername', testOrg.username, '--urlonly', '--source-file', flexipagePath],
          {} as Config
        );

        $$.SANDBOX.stub(Connection.prototype, 'singleRecordQuery').resolves({ Id: '123' });

        const response = await cmd.run();
        expect(response.url).to.include('visualEditor/appBuilder.app?pageId=123');
      });

      it('--source-file to an ApexPage', async () => {
        const cmd = new OrgOpenCommand(
          ['--json', '--targetusername', testOrg.username, '--urlonly', '--source-file', apexPath],
          {} as Config
        );

        const response = await cmd.run();
        expect(response.url).to.include('&retURL=/apex/test');
      });

      it('--source-file when flexipage query errors', async () => {
        const cmd = new OrgOpenCommand(
          ['--json', '--targetusername', testOrg.username, '--urlonly', '--source-file', flexipagesDir],
          {} as Config
        );

        const response = await cmd.run();
        expect(response.url).to.include('lightning/setup/FlexiPageList/home');
      });

      it('--source-file to neither flexipage or apexpage', async () => {
        const cmd = new OrgOpenCommand(
          ['--json', '--targetusername', testOrg.username, '--urlonly', '--source-file', apexDir],
          {} as Config
        );

        const response = await cmd.run();
        expect(response.url).to.include('lightning/setup/FlexiPageList/home');
      });
    });

    it('can read url from env', async () => {
      process.env.FORCE_OPEN_URL = testPath;

      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--urlonly']);
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

      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedUrl);

      expect(spies.get('resolver').callCount).to.equal(1);
    });

    it('handles domain timeouts', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').throws(new Error('timeout')));
      try {
        await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);
      } catch (e) {
        expect(spies.get('resolver').callCount).to.equal(1);
        expect(spies.get('open').callCount).to.equal(0);
        assert(e instanceof SfError, 'should be an SfError');
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
      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedUrl);
      expect(spies.get('resolver').callCount).to.equal(0);
      delete process.env.SFDX_CONTAINER_MODE;
    });

    it('does not wait for domains when timeouts are zero, even without urlonly', async () => {
      process.env.SFDX_DOMAIN_RETRY = '0';

      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);
      assert(response);
      testJsonStructure(response);
      expect(spies.get('resolver').callCount).to.equal(0);
      delete process.env.SFDX_DOMAIN_RETRY;
    });
  });

  describe('human output', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, MyDomainResolver, 'create').resolves(MyDomainResolver.prototype);
    });

    it('calls open and outputs proper success message (no url)', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));
      await OrgOpenCommand.run(['--targetusername', testOrg.username, '--path', testPath]);

      expect(sfCommandUxStubs.logSuccess.firstCall.args).to.include(
        messages.getMessage('humanSuccessNoUrl', [testOrg.orgId, testOrg.username])
      );
      expect(spies.get('resolver').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
    });

    it('outputs proper warning and message (includes url for --urlonly)', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));

      await OrgOpenCommand.run(['--targetusername', testOrg.username, '--path', testPath, '--urlonly']);

      expect(sfCommandUxStubs.logSuccess.firstCall.args).to.include(
        messages.getMessage('humanSuccess', [testOrg.orgId, testOrg.username, expectedUrl])
      );
    });

    it('throws on dns fail', async () => {
      spies.set(
        'resolver',
        stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').rejects(new Error('timeout'))
      );

      try {
        await shouldThrow(OrgOpenCommand.run(['--targetusername', testOrg.username, '--path', testPath]));
      } catch (e) {
        const error = e as SfError;
        expect(error.message).to.contain(messages.getMessage('domainTimeoutError'));
        expect(spies.get('resolver').callCount).to.equal(1);
        expect(spies.get('open').callCount).to.equal(0);
      }
    });
  });

  describe('browser argument', () => {
    it('calls open with no browser argument', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));

      await OrgOpenCommand.run(['--targetusername', testOrg.username, '--path', testPath]);
      expect(
        sfCommandUxStubs.logSuccess.calledOnceWith(
          messages.getMessage('humanSuccessNoUrl', [testOrg.orgId, testOrg.username])
        )
      );
      expect(sfCommandUxStubs.warn.calledOnceWith(sharedMessages.getMessage('SecurityWarning')));

      expect(spies.get('resolver').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.deep.equal({ newInstance: true });
    });

    it('calls open with a browser argument', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));

      await OrgOpenCommand.run(['--targetusername', testOrg.username, '--path', testPath, '-b', testBrowser]);

      expect(sfCommandUxStubs.warn(sharedMessages.getMessage('SecurityWarning')));
      expect(
        sfCommandUxStubs.logSuccess.calledOnceWith(
          messages.getMessage('humanSuccessNoUrl', [testOrg.orgId, testOrg.username])
        )
      );

      expect(spies.get('resolver').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.not.eql({});
    });

    it('does not call open as passed unknown browser name', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));

      try {
        await shouldThrow(OrgOpenCommand.run(['--targetusername', testOrg.username, '--path', testPath, '-b', 'duff']));
      } catch (e) {
        // as expected
      }
      expect(spies.get('resolver').callCount).to.equal(0);
      expect(spies.get('open').callCount).to.equal(0);
    });
  });
});
