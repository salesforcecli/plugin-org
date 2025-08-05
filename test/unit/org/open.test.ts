/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { join } from 'node:path';
import * as process from 'node:process';
import { assert, expect } from 'chai';
import { Connection, Messages, Org, SfdcUrl, SfError } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { MockTestOrgData, shouldThrow, TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx, stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import { OrgOpenCommand } from '../../../src/commands/org/open.js';
import { OrgOpenOutput } from '../../../src/shared/orgTypes.js';
import utils from '../../../src/shared/orgOpenUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-org', 'messages');

describe('org:open', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  const testBrowser = 'firefox';
  const testPath = '/lightning/whatever';
  const singleUseToken = (Math.random() + 1).toString(36).substring(2); // random string to simulate a single-use token
  const expectedDefaultSingleUseUrl = `${testOrg.instanceUrl}/secur/frontdoor.jsp?otp=${singleUseToken}`;
  const expectedSingleUseUrl = `${expectedDefaultSingleUseUrl}&startURL=${encodeURIComponent(testPath)}`;

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
    spies.set('open', stubMethod($$.SANDBOX, utils, 'openUrl').resolves(new EventEmitter()));
    spies.set(
      'requestGet',
      stubMethod($$.SANDBOX, Connection.prototype, 'requestGet').resolves({
        // eslint-disable-next-line camelcase
        frontdoor_uri: expectedDefaultSingleUseUrl,
      })
    );
  });

  afterEach(() => {
    spies.clear();
  });

  describe('url generation', () => {
    it('org without a url defaults to proper default', async () => {
      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--urlonly']);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedDefaultSingleUseUrl);
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
      expect(response.url).to.equal(expectedSingleUseUrl);
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
        $$.SANDBOX.stub(Connection.prototype, 'singleRecordQuery').resolves({ Id: '123' });
        const mockMetadataUrl = 'visualEditor/appBuilder.app?pageId=123';
        $$.SANDBOX.stub(Org.prototype, 'getMetadataUIURL').resolves(mockMetadataUrl);

        const response = await OrgOpenCommand.run([
          '--json',
          '--targetusername',
          testOrg.username,
          '--urlonly',
          '--source-file',
          flexipagePath,
        ]);

        expect(response.url).to.include('visualEditor/appBuilder.app?pageId=123');
      });

      it('--source-file to an ApexPage', async () => {
        const mockMetadataUrl = '/apex/test';
        $$.SANDBOX.stub(Org.prototype, 'getMetadataUIURL').resolves(mockMetadataUrl);

        const response = await OrgOpenCommand.run([
          '--json',
          '--targetusername',
          testOrg.username,
          '--urlonly',
          '--source-file',
          apexPath,
        ]);
        expect(response.url).to.include('&startURL=/apex/test');
      });

      it('--source-file when flexipage query errors', async () => {
        try {
          await OrgOpenCommand.run([
            '--json',
            '--targetusername',
            testOrg.username,
            '--urlonly',
            '--source-file',
            flexipagesDir,
          ]);
          expect.fail('should have thrown an error');
        } catch (e) {
          assert(e instanceof Error);
          expect(e.message).to.include(`Unable to generate metadata URL for file: ${flexipagesDir}`);
        }
      });

      it('--source-file to neither flexipage or apexpage', async () => {
        try {
          await OrgOpenCommand.run([
            '--json',
            '--targetusername',
            testOrg.username,
            '--urlonly',
            '--source-file',
            apexDir,
          ]);
          expect.fail('should have thrown an error');
        } catch (e) {
          assert(e instanceof Error);
          expect(e.message).to.include(`Unable to generate metadata URL for file: ${apexDir}`);
        }
      });
    });

    it('can read url from env', async () => {
      process.env.FORCE_OPEN_URL = testPath;

      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--urlonly']);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedSingleUseUrl);
      expect(spies.get('requestGet').callCount).to.equal(1);
      delete process.env.FORCE_OPEN_URL;
    });

    it('generates a single-use frontdoor url when neither --url-only nor --json flag are passed in', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));
      const response = await OrgOpenCommand.run(['--targetusername', testOrg.username]);
      expect(response.url).to.equal(expectedDefaultSingleUseUrl);
      // verify we called to the correct endpoint to generate the single-use AT
      expect(spies.get('requestGet').callCount).to.equal(1);
      expect(spies.get('requestGet').args[0][0]).to.deep.equal(`${testOrg.instanceUrl}/services/oauth2/singleaccess`);
    });

    it('generates a single-use frontdoor url even if --url-only or --json flag are passed in', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));
      const response = await OrgOpenCommand.run(['--targetusername', testOrg.username, '--json', '--url-only']);
      expect(response.url).to.equal(expectedDefaultSingleUseUrl);
      // verify we called to the correct endpoint to generate the single-use AT
      expect(spies.get('requestGet').callCount).to.equal(1);
      expect(spies.get('requestGet').args[0][0]).to.deep.equal(`${testOrg.instanceUrl}/services/oauth2/singleaccess`);
    });

    it('handles api error', async () => {
      $$.SANDBOX.restore();
      const mockError = new Error('Invalid_Scope');
      mockError.name = 'Invalid_Scope';
      $$.SANDBOX.stub(Connection.prototype, 'requestGet').throws(mockError);
      try {
        await OrgOpenCommand.run(['--targetusername', testOrg.username]);
        expect.fail('should have thrown Invalid_Scope');
      } catch (e) {
        assert(e instanceof SfError, 'should be an SfError');
        expect(e.name).to.equal('Invalid_Scope');
        expect(e.message).to.equal(sharedMessages.getMessage('SingleAccessFrontdoorError'));
      }
    });

    it('handles invalid responde from api', async () => {
      $$.SANDBOX.restore();
      $$.SANDBOX.stub(Connection.prototype, 'requestGet').resolves({
        invalid: 'some invalid response',
      });
      try {
        await OrgOpenCommand.run(['--targetusername', testOrg.username]);
        expect.fail('should have thrown Invalid_Scope');
      } catch (e) {
        assert(e instanceof SfError, 'should be an SfError');
        expect(e.message).to.equal(sharedMessages.getMessage('SingleAccessFrontdoorError'));
        expect(e.data).to.contain({ invalid: 'some invalid response' });
      }
    });
  });

  describe('domain resolution, with callout', () => {
    it('waits on domains that need time to resolve', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));

      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedSingleUseUrl);

      expect(spies.get('resolver').callCount).to.equal(1);
    });

    it('handles domain timeouts', async () => {
      spies.set(
        'resolver',
        stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').throws(new Error('timeout'))
      );
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
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));
    });

    it('does not wait for domains in container mode, even without urlonly', async () => {
      process.env.SFDX_CONTAINER_MODE = 'true';
      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedSingleUseUrl);
      expect(spies.get('resolver').callCount).to.equal(0);
      delete process.env.SFDX_CONTAINER_MODE;
    });

    it('does not wait for domains when timeouts are zero, even without urlonly', async () => {
      process.env.SF_DOMAIN_RETRY = '0';

      const response = await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);
      assert(response);
      testJsonStructure(response);
      expect(response.url).to.equal(expectedSingleUseUrl);
      expect(spies.get('resolver').callCount).to.equal(1);
      delete process.env.SF_DOMAIN_RETRY;
    });
  });

  describe('human output', () => {
    it('calls open and outputs proper success message (no url)', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));
      await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);

      expect(sfCommandUxStubs.logSuccess.firstCall.args).to.include(
        messages.getMessage('humanSuccessNoUrl', [testOrg.orgId, testOrg.username])
      );
      // expect(spies.get('resolver').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
    });

    it('outputs proper warning and message (includes url for --urlonly)', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));

      await OrgOpenCommand.run(['--targetusername', testOrg.username, '--path', testPath, '--urlonly']);

      expect(sfCommandUxStubs.logSuccess.firstCall.args).to.include(
        messages.getMessage('humanSuccess', [testOrg.orgId, testOrg.username, expectedSingleUseUrl])
      );
    });

    it('throws on dns fail', async () => {
      spies.set(
        'resolver',
        stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').rejects(new Error('timeout'))
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
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));

      await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath]);
      expect(
        sfCommandUxStubs.logSuccess.calledOnceWith(
          messages.getMessage('humanSuccessNoUrl', [testOrg.orgId, testOrg.username])
        )
      );
      expect(sfCommandUxStubs.warn.calledOnceWith(sharedMessages.getMessage('SecurityWarning')));

      expect(spies.get('resolver').callCount).to.equal(1);
      expect(spies.get('open').callCount).to.equal(1);
      expect(spies.get('open').args[0][1]).to.deep.equal({});
    });

    it('calls open with a browser argument', async () => {
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));

      await OrgOpenCommand.run(['--json', '--targetusername', testOrg.username, '--path', testPath, '-b', testBrowser]);

      expect(sfCommandUxStubs.warn.calledOnceWith(sharedMessages.getMessage('SecurityWarning')));
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
      spies.set('resolver', stubMethod($$.SANDBOX, SfdcUrl.prototype, 'checkLightningDomain').resolves('1.1.1.1'));

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
