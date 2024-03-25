/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ConfigAggregator,
  Lifecycle,
  Messages,
  Org,
  OrgConfigProperties,
  SandboxEvents,
  SandboxProcessObject,
  SandboxUserAuthResponse,
  SfError,
} from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import sinon from 'sinon';
import { MockTestOrgData, shouldThrow, TestContext } from '@salesforce/core/lib/testSetup.js';
import { expect, config, assert } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { Create } from '../../../../src/commands/force/org/create.js';
import requestFunctions from '../../../../src/shared/sandboxRequest.js';

config.truncateThreshold = 0;
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create');

describe('[DEPRECATED] force:org:create (sandbox paths)', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  // stubs
  let createSandboxStub: sinon.SinonStub;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await $$.stubConfig({});
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
  });

  describe('sandbox', () => {
    it('will parse the --type flag correctly to create a sandbox', async () => {
      createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
      await Create.run(['--type', 'sandbox', '-u', testOrg.username]);
      expect(createSandboxStub.callCount).to.equal(1);
    });

    describe('warnings about flags that do not work with sandboxes', () => {
      it('will warn the user when --clientid is passed', async () => {
        const clientId = '123';
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        await Create.run(['--type', 'sandbox', '--clientid', clientId, '-u', testOrg.username]);
        expect(sfCommandUxStubs.warn.getCalls().flatMap((call) => call.args)).deep.include(
          messages.getMessage('clientIdNotSupported', [clientId])
        );
        expect(createSandboxStub.callCount).to.equal(1);
      });

      it('will warn the user when --nonamespace is passed', async () => {
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        await Create.run(['--type', 'sandbox', '--nonamespace', '-u', testOrg.username]);
        expect(sfCommandUxStubs.warn.getCalls().flatMap((call) => call.args)).deep.include(
          messages.getMessage('noNamespaceNotSupported', [true])
        );
        expect(createSandboxStub.callCount).to.equal(1);
      });
      it('will warn the user when --noancestors is passed', async () => {
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        await Create.run(['--type', 'sandbox', '--noancestors', '-u', testOrg.username]);

        expect(sfCommandUxStubs.warn.getCalls().flatMap((call) => call.args)).deep.include(
          messages.getMessage('noAncestorsNotSupported', [true])
        );
        expect(createSandboxStub.callCount).to.equal(1);
      });
      it('will warn the user when --durationdays is passed', async () => {
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        await Create.run(['--type', 'sandbox', '--durationdays', '1', '-u', testOrg.username]);

        expect(sfCommandUxStubs.warn.getCalls().flatMap((call) => call.args)).deep.include(
          messages.getMessage('durationDaysNotSupported', [1])
        );
        expect(createSandboxStub.callCount).to.equal(1);
      });
      it('will throw an error when creating a sandbox with retry', async () => {
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        try {
          await shouldThrow(Create.run(['--type', 'sandbox', '--retry', '1', '-u', testOrg.username]));
        } catch (e) {
          assert(e instanceof SfError, 'Expect error to be an instance of SfError');
          expect(e.name).to.equal('retryIsNotValidForSandboxes');
          expect(createSandboxStub.callCount).to.equal(0);
        }
      });
    });

    const sandboxProcessObj: SandboxProcessObject = {
      Id: '0GR4p000000U8EMXXX',
      Status: 'Completed',
      SandboxName: 'TestSandbox',
      SandboxInfoId: '0GQ4p000000U6sKXXX',
      LicenseType: 'DEVELOPER',
      CreatedDate: '2021-12-07T16:20:21.000+0000',
      CopyProgress: 100,
      SandboxOrganization: '00D2f0000008XXX',
      SourceId: '123',
      Description: 'sandbox description',
      ApexClassId: '123',
      EndDate: '2021-12-07T16:38:47.000+0000',
    };

    it('will print the correct message for asyncResult lifecycle event', async () => {
      Lifecycle.getInstance().removeAllListeners(SandboxEvents.EVENT_ASYNC_RESULT);
      stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({
        sandboxReq: { SandboxName: 'sbox' },
      });
      stubMethod($$.SANDBOX, Org.prototype, 'createSandbox').resolves();

      await Create.run(['--type', 'sandbox', '-u', testOrg.username]);

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_ASYNC_RESULT, sandboxProcessObj);
      expect(sfCommandUxStubs.log.getCalls().flatMap((call) => call.args)).to.deep.include(
        `The sandbox org creation process 0GR4p000000U8EMXXX is in progress. Run "mocha force:org:status -n TestSandbox -u ${testOrg.username}" to check for status. If the org is ready, checking the status also authorizes the org for use with Salesforce CLI.`
      );
      Lifecycle.getInstance().removeAllListeners(SandboxEvents.EVENT_ASYNC_RESULT);
    });

    it('will set alias/defaultusername', async () => {
      Lifecycle.getInstance().removeAllListeners(SandboxEvents.EVENT_RESULT);

      stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({
        sandboxReq: { SandboxName: 'sbox', licenseType: 'DEVELOPER' },
      });
      stubMethod($$.SANDBOX, Org.prototype, 'createSandbox').resolves();

      Lifecycle.getInstance().on(SandboxEvents.EVENT_RESULT, async (result) => {
        expect(result).to.deep.equal(data);
        const logs = $$.TEST_LOGGER.getBufferedRecords();
        expect(logs.some((line) => line.msg.includes('Set defaultUsername:')));
        return Promise.resolve();
      });

      const sandboxRes: SandboxUserAuthResponse = {
        authCode: 'sandboxTestAuthCode',
        authUserName: 'newSandboxUsername',
        instanceUrl: 'https://login.salesforce.com',
        loginUrl: 'https://productionOrg--createdSandbox.salesforce.com/',
      };
      const data = { sandboxProcessObj, sandboxRes };

      await Create.run([
        '--type',
        'sandbox',
        '--setalias',
        'sandboxAlias',
        '--setdefaultusername',
        '-u',
        testOrg.username,
      ]);

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_RESULT, data);
      Lifecycle.getInstance().removeAllListeners(SandboxEvents.EVENT_RESULT);
      const configAggregator = await ConfigAggregator.create();
      await configAggregator.reload();
      expect(configAggregator.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG)).to.equal('newSandboxUsername');
    });

    it('will wrap the partial success error correctly', async () => {
      stubMethod($$.SANDBOX, Org.prototype, 'createSandbox').throws({ message: 'The org cannot be found' });
      stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({
        sandboxReq: { SandboxName: 'sbox', licenseType: 'DEVELOPER' },
      });
      try {
        await shouldThrow(Create.run(['--type', 'sandbox', '-u', testOrg.username]));
      } catch (err) {
        // shouldThrow doesn't necessarily throw an SfError
        assert(err instanceof SfError, 'Expect error to be an instance of SfError');
        expect(err.code).to.equal(68);
        try {
          // mocha really is the bin during UT
          expect(err.actions).to.deep.equal([
            messages.getMessage('dnsTimeout', ['mocha', 'mocha']),
            messages.getMessage('partialSuccess', ['mocha', 'mocha', 'mocha']),
          ]);
        } catch (e) {
          expect(err.actions).to.deep.equal([
            messages.getMessage('dnsTimeout', ['sfdx', 'sfdx']),
            messages.getMessage('partialSuccess', ['sfdx', 'sfdx', 'sfdx']),
          ]);
        }
      }
    });
  });
});
