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
import * as sinon from 'sinon';
import { Config as IConfig } from '@oclif/core';
import { MockTestOrgData, shouldThrow, TestContext } from '@salesforce/core/lib/testSetup';
import { assert, expect, config } from 'chai';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Create } from '../../../../src/commands/force/org/create';
import * as requestFunctions from '../../../../src/shared/sandboxRequest';

config.truncateThreshold = 0;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create');

describe('org:create (sandbox paths)', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  // stubs
  let createSandboxStub: sinon.SinonStub;
  let uxWarnStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  // let uxTableStub: sinon.SinonStub;
  // let uxStyledHeaderStub: sinon.SinonStub;

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await $$.stubConfig({});
    uxWarnStub = stubMethod($$.SANDBOX, SfCommand.prototype, 'warn');
    uxLogStub = stubMethod($$.SANDBOX, SfCommand.prototype, 'log');
    // uxTableStub = stubMethod($$.SANDBOX, SfCommand.prototype, 'table');
    // uxStyledHeaderStub = stubMethod($$.SANDBOX, SfCommand.prototype, 'styledHeader');
  });
  afterEach(() => {
    $$.restore();
  });

  const getCreateCommand = (params: string[]) => new Create(params, {} as IConfig);

  describe('sandbox', () => {
    it('will parse the --type flag correctly to create a sandbox', async () => {
      const cmd = getCreateCommand(['--type', 'sandbox', '-u', testOrg.username]);
      createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
      await cmd.run();
      expect(createSandboxStub.callCount).to.equal(1);
    });

    describe('warnings about flags that do not work with sandboxes', () => {
      it('will warn the user when --clientid is passed', async () => {
        const clientId = '123';
        const cmd = getCreateCommand(['--type', 'sandbox', '--clientid', clientId, '-u', testOrg.username]);
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        await cmd.run();
        expect(uxWarnStub.getCalls().flatMap((call) => call.args)).deep.include(
          messages.getMessage('clientIdNotSupported', [clientId])
        );
        expect(createSandboxStub.callCount).to.equal(1);
      });

      it('will warn the user when --nonamespace is passed', async () => {
        const cmd = getCreateCommand(['--type', 'sandbox', '--nonamespace', '-u', testOrg.username]);
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        await cmd.run();
        expect(uxWarnStub.getCalls().flatMap((call) => call.args)).deep.include(
          messages.getMessage('noNamespaceNotSupported', [true])
        );
        expect(createSandboxStub.callCount).to.equal(1);
      });
      it('will warn the user when --noancestors is passed', async () => {
        const cmd = getCreateCommand(['--type', 'sandbox', '--noancestors', '-u', testOrg.username]);
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        await cmd.run();

        expect(uxWarnStub.getCalls().flatMap((call) => call.args)).deep.include(
          messages.getMessage('noAncestorsNotSupported', [true])
        );
        expect(createSandboxStub.callCount).to.equal(1);
      });
      it('will warn the user when --durationdays is passed', async () => {
        const cmd = getCreateCommand(['--type', 'sandbox', '--durationdays', '1', '-u', testOrg.username]);
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        await cmd.run();

        expect(uxWarnStub.getCalls().flatMap((call) => call.args)).deep.include(
          messages.getMessage('durationDaysNotSupported', [1])
        );
        expect(createSandboxStub.callCount).to.equal(1);
      });
      it('will throw an error when creating a sandbox with retry', async () => {
        const cmd = getCreateCommand(['--type', 'sandbox', '--retry', '1', '-u', testOrg.username]);
        createSandboxStub = stubMethod($$.SANDBOX, Create.prototype, 'createSandbox').resolves();
        try {
          await shouldThrow(cmd.run());
        } catch (e) {
          assert(e instanceof Error);
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

      const cmd = getCreateCommand(['--type', 'sandbox', '-u', testOrg.username]);
      await cmd.run();

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_ASYNC_RESULT, sandboxProcessObj);
      expect(uxLogStub.getCalls().flatMap((call) => call.args)).to.deep.include(
        `The sandbox org creation process 0GR4p000000U8EMXXX is in progress. Run "sfdx force:org:status -n TestSandbox -u ${testOrg.username}" to check for status. If the org is ready, checking the status also authorizes the org for use with Salesforce CLI.`
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
      // expect(uxTableStub.callCount).to.equal(1);
      // expect(uxStyledHeaderStub.callCount).to.equal(1);
      Lifecycle.getInstance().removeAllListeners(SandboxEvents.EVENT_RESULT);
      const configAggregator = await ConfigAggregator.create();
      await configAggregator.reload();
      expect(configAggregator.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG)).to.equal('newSandboxUsername');
    });

    it('will wrap the partial success error correctly', async () => {
      const cmd = getCreateCommand(['--type', 'sandbox', '-u', testOrg.username]);
      stubMethod($$.SANDBOX, Org.prototype, 'createSandbox').throws({ message: 'The org cannot be found' });
      stubMethod($$.SANDBOX, requestFunctions, 'createSandboxRequest').resolves({
        sandboxReq: { SandboxName: 'sbox', licenseType: 'DEVELOPER' },
      });
      try {
        await shouldThrow(cmd.run());
      } catch (err) {
        // shouldThrow doesn't necessarily throw an SfError
        const e = err as SfError;
        expect(e.exitCode).to.equal(68);
        assert(e.actions);
        assert(e.actions.length === 2);
        expect(e.actions[0]).to.equal(messages.getMessage('dnsTimeout'));
        expect(e.actions[1]).to.equal(messages.getMessage('partialSuccess'));
      }
    });
  });
});
