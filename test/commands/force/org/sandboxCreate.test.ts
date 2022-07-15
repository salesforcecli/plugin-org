/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  StateAggregator,
  Config,
  Lifecycle,
  Messages,
  Org,
  SandboxEvents,
  SandboxProcessObject,
  SandboxUserAuthResponse,
  StatusEvent,
  SfProject,
} from '@salesforce/core';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { expect } from '@salesforce/command/lib/test';
import { Config as IConfig } from '@oclif/core';
import { UX } from '@salesforce/command';
import { assert } from 'sinon';
import { Create } from '../../../../src/commands/force/org/beta/create';
import { SandboxReporter } from '../../../../src/shared/sandboxReporter';
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create');
describe('org:create', () => {
  const sandbox = sinon.createSandbox();
  const oclifConfigStub = fromStub(stubInterface<IConfig>(sandbox));

  // stubs
  let resolveProjectConfigStub: sinon.SinonStub;
  let createSandboxStub: sinon.SinonStub;
  let uxWarnStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  let uxTableStub: sinon.SinonStub;
  let uxStyledHeaderStub: sinon.SinonStub;
  let aliasSetStub: sinon.SinonSpy;
  let cmd: TestCreate;

  class TestCreate extends Create {
    public async runIt() {
      await this.init();
      return this.run();
    }
    public setOrg(org: Org) {
      this.org = org;
    }
    public setProject(project: SfProject) {
      this.project = project;
    }
  }

  const createCommand = async (params: string[]) => {
    cmd = new TestCreate(params, oclifConfigStub);
    stubMethod(sandbox, cmd, 'assignProject').callsFake(() => {
      const sfdxProjectStub = fromStub(
        stubInterface<SfProject>(sandbox, {
          resolveProjectConfig: resolveProjectConfigStub,
        })
      );
      cmd.setProject(sfdxProjectStub);
    });

    createSandboxStub = stubMethod(sandbox, cmd, 'createSandbox').resolves();

    uxWarnStub = stubMethod(sandbox, UX.prototype, 'warn');
    uxLogStub = stubMethod(sandbox, UX.prototype, 'log');
    uxStyledHeaderStub = stubMethod(sandbox, UX.prototype, 'styledHeader');
    uxTableStub = stubMethod(sandbox, UX.prototype, 'table');
    stubMethod(sandbox, cmd, 'assignOrg').callsFake(() => {
      const orgStubOptions = {};

      const orgStub = fromStub(stubInterface<Org>(sandbox, orgStubOptions));
      cmd.setOrg(orgStub);
    });
    return cmd;
  };

  describe('sandbox', () => {
    it('will parse the --type flag correctly to create a sandbox', async () => {
      const command = await createCommand(['--type', 'sandbox', '-u', 'testProdOrg']);
      await command.runIt();
      expect(createSandboxStub.calledOnce).to.be.true;
    });

    it('will warn the user when --clientid is passed', async () => {
      const commmand = await createCommand(['--type', 'sandbox', '--clientid', '123', '-u', 'testProdOrg']);
      await commmand.runIt();
      expect(uxWarnStub.calledTwice).to.be.true;
      expect(uxWarnStub.firstCall.args[0]).to.equal(
        '-i | --clientid is not supported for the sandbox org create command. Its value, 123, has been ignored.'
      );
      expect(createSandboxStub.calledOnce).to.be.true;
    });

    it('will warn the user when --nonamespace is passed', async () => {
      const commmand = await createCommand(['--type', 'sandbox', '--nonamespace', '-u', 'testProdOrg']);
      await commmand.runIt();
      expect(uxWarnStub.calledTwice).to.be.true;
      expect(uxWarnStub.firstCall.args[0]).to.equal(
        '-n | --nonamespace is not supported for the sandbox org create command. Its value, true, has been ignored.'
      );
      expect(createSandboxStub.calledOnce).to.be.true;
    });
    it('will warn the user when --noancestors is passed', async () => {
      const commmand = await createCommand(['--type', 'sandbox', '--noancestors', '-u', 'testProdOrg']);
      await commmand.runIt();
      expect(uxWarnStub.calledTwice).to.be.true;
      expect(uxWarnStub.firstCall.args[0]).to.equal(
        '-c | --noancestors is not supported for the sandbox org create command. Its value, true, has been ignored.'
      );
      expect(createSandboxStub.calledOnce).to.be.true;
    });
    it('will warn the user when --durationdays is passed', async () => {
      const commmand = await createCommand(['--type', 'sandbox', '--durationdays', '1', '-u', 'testProdOrg']);
      await commmand.runIt();
      expect(uxWarnStub.calledOnce).to.be.true;
      expect(uxWarnStub.firstCall.args[0]).to.equal(
        '-d | --durationdays is not supported for the sandbox org create command. Its value, 1, has been ignored.'
      );
      expect(createSandboxStub.calledOnce).to.be.true;
    });

    it('will throw an error when creating a sandbox with retry', async () => {
      try {
        const command = await createCommand(['--type', 'sandbox', '--retry', '1', '-u', 'testProdOrg']);
        await command.runIt();
      } catch (e) {
        expect(e.name).to.equal('retryIsNotValidForSandboxes');
        expect(createSandboxStub.callCount).to.equal(0);
      }
    });

    it('properly overwrites options from defaults, varargs, and definition file', async () => {
      const command = await createCommand([
        '--type',
        'sandbox',
        'licenseType=LicenseFromVarargs',
        '--definitionfile',
        'mySandboxDef.json',
        '-u',
        'testProdOrg',
      ]);

      createSandboxStub.restore();
      stubMethod(sandbox, cmd, 'readJsonDefFile').returns({
        licenseType: 'licenseFromJson',
        sandboxName: 'sandboxNameFromJson',
      });
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      const prodOrg = stubMethod(sandbox, Org.prototype, 'createSandbox');
      await command.runIt();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        SandboxName: 'sandboxNameFromJson',
        LicenseType: 'LicenseFromVarargs',
      });
    });

    it('properly overwrites options from defaults, varargs, and definition file with mixed capitalization', async () => {
      const command = await createCommand([
        '--type',
        'sandbox',
        'LicenseType=LicenseFromVarargs',
        '--definitionfile',
        'mySandboxDef.json',
        '-u',
        'testProdOrg',
      ]);

      createSandboxStub.restore();
      stubMethod(sandbox, cmd, 'readJsonDefFile').returns({
        licenseType: 'licenseFromJson',
        sandboxName: 'sandboxNameFromJson',
      });
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      const prodOrg = stubMethod(sandbox, Org.prototype, 'createSandbox');
      await command.runIt();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        SandboxName: 'sandboxNameFromJson',
        LicenseType: 'LicenseFromVarargs',
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
      const command = await createCommand(['--type', 'sandbox', '-u', 'testProdOrg']);

      createSandboxStub.restore();
      stubMethod(sandbox, cmd, 'readJsonDefFile').returns({
        licenseType: 'licenseFromJon',
      });
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      const createStub = stubMethod(sandbox, Org.prototype, 'createSandbox');
      await command.runIt();

      // no SandboxName defined, so we should generate one that starts with sbx
      expect(createStub.firstCall.args[0].SandboxName).includes('sbx');
      expect(createStub.firstCall.args[0].SandboxName.length).equals(10);

      Lifecycle.getInstance().on(SandboxEvents.EVENT_ASYNC_RESULT, async (result) => {
        expect(result).to.deep.equal(sandboxProcessObj);
        expect(uxLogStub.firstCall.args[0]).to.equal(
          'The sandbox org creation process 0GR4p000000U8EMXXX is in progress. Run "sfdx force:org:status -n TestSandbox -u testProdOrg" to check for status. If the org is ready, checking the status also authorizes the org for use with Salesforce CLI.'
        );
      });

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_ASYNC_RESULT, sandboxProcessObj);
    });

    it('will print the correct message for status lifecycle event (30 seconds left)', async () => {
      const command = await createCommand(['--type', 'sandbox', '-u', 'testProdOrg']);

      createSandboxStub.restore();
      stubMethod(sandbox, cmd, 'readJsonDefFile').returns({
        licenseType: 'licenseFromJon',
        sandboxName: 'sandboxNameFromJson',
      });
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'createSandbox');
      await command.runIt();

      Lifecycle.getInstance().on(SandboxEvents.EVENT_STATUS, async () => {
        expect(uxLogStub.firstCall.args[0]).to.equal(
          'Sandbox request TestSandbox(0GR4p000000U8EMXXX) is Completed (100% completed). Sleeping 30 seconds. Will wait 30 seconds more before timing out.'
        );
      });

      const data: StatusEvent = {
        sandboxProcessObj,
        interval: 30,
        remainingWait: 30,
        waitingOnAuth: false,
      };

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_STATUS, data);
    });

    it('will print the correct message for result lifecycle event and set alias/defaultusername', async () => {
      const command = await createCommand([
        '--type',
        'sandbox',
        '--setalias',
        'sandboxAlias',
        '--setdefaultusername',
        '-u',
        'testProdOrg',
      ]);

      createSandboxStub.restore();
      stubMethod(sandbox, cmd, 'readJsonDefFile').returns({
        licenseType: 'licenseFromJon',
      });
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'createSandbox');

      aliasSetStub = sinon.spy();
      stubMethod(sandbox, StateAggregator, 'getInstance').returns({
        aliases: {
          set: aliasSetStub,
          write: sinon.stub(),
        },
      });
      const configStub = stubMethod(sandbox, Config.prototype, 'set');
      await command.runIt();

      Lifecycle.getInstance().on(SandboxEvents.EVENT_RESULT, async (result) => {
        expect(result).to.deep.equal(data);
        expect(uxLogStub.firstCall.args[0]).to.equal('Sandbox TestSandbox(0GR4p000000U8EMXXX) is ready for use.');
        expect(uxStyledHeaderStub.firstCall.args[0]).to.equal('Sandbox Org Creation Status');
        expect(uxTableStub.firstCall.args[0].length).to.equal(12);
        expect(uxTableStub.firstCall.args[0]).to.deep.equal([
          {
            key: 'Id',
            value: '0GR4p000000U8EMXXX',
          },
          {
            key: 'SandboxName',
            value: 'TestSandbox',
          },
          {
            key: 'Status',
            value: 'Completed',
          },
          {
            key: 'CopyProgress',
            value: 100,
          },
          {
            key: 'Description',
            value: 'sandbox description',
          },
          {
            key: 'LicenseType',
            value: 'DEVELOPER',
          },
          {
            key: 'SandboxInfoId',
            value: '0GQ4p000000U6sKXXX',
          },
          {
            key: 'SourceId',
            value: '123',
          },
          {
            key: 'SandboxOrg',
            value: '00D2f0000008XXX',
          },
          {
            key: 'Created Date',
            value: '2021-12-07T16:20:21.000+0000',
          },
          {
            key: 'ApexClassId',
            value: '123',
          },
          {
            key: 'Authorized Sandbox Username',
            value: 'newSandboxUsername',
          },
        ]);
        expect(aliasSetStub.firstCall.args).to.deep.equal(['sandboxAlias', 'newSandboxUsername']);
        expect(configStub.firstCall.args).to.deep.equal(['target-org', 'newSandboxUsername']);
      });

      const sandboxRes: SandboxUserAuthResponse = {
        authCode: 'sandboxTestAuthCode',
        authUserName: 'newSandboxUsername',
        instanceUrl: 'https://login.salesforce.com',
        loginUrl: 'https://productionOrg--createdSandbox.salesforce.com/',
      };
      const data = { sandboxProcessObj, sandboxRes };

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_RESULT, data);
    });

    it('will calculate the correct human readable message (1h 33min 00seconds seconds left)', async () => {
      const data = {
        sandboxProcessObj,
        interval: 30,
        remainingWait: 5580,
        waitingOnAuth: false,
      };
      const res = SandboxReporter.sandboxProgress(data);
      expect(res).to.equal(
        'Sandbox request TestSandbox(0GR4p000000U8EMXXX) is Completed (100% completed). Sleeping 30 seconds. Will wait 1 hour 33 minutes more before timing out.'
      );
    });

    it('will calculate the correct human readable message (5 min 30seconds seconds left)', async () => {
      const data: StatusEvent = {
        sandboxProcessObj,
        interval: 30,
        remainingWait: 330,
        waitingOnAuth: false,
      };
      const res = SandboxReporter.sandboxProgress(data);
      expect(res).to.equal(
        'Sandbox request TestSandbox(0GR4p000000U8EMXXX) is Completed (100% completed). Sleeping 30 seconds. Will wait 5 minutes 30 seconds more before timing out.'
      );
    });

    it('will wrap the partial success error correctly', async () => {
      const command = await createCommand(['--type', 'sandbox', '-u', 'testProdOrg']);

      createSandboxStub.restore();
      stubMethod(sandbox, cmd, 'readJsonDefFile').returns({
        licenseType: 'licenseFromJon',
        sandboxName: 'sandboxNameFromJson',
      });
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'createSandbox').throws({ message: 'The org cannot be found' });
      try {
        await command.runIt();
        assert.fail('the above should throw an error');
      } catch (e) {
        expect(e.actions[0]).to.equal(messages.getMessage('dnsTimeout'));
        expect(e.actions[1]).to.equal(messages.getMessage('partialSuccess'));
        expect(e.exitCode).to.equal(68);
      }

      Lifecycle.getInstance().on(SandboxEvents.EVENT_STATUS, async () => {
        expect(uxLogStub.firstCall.args[0]).to.equal(
          'Sandbox request TestSandbox(0GR4p000000U8EMXXX) is Completed (100% completed). Sleeping 30 seconds. Will wait 30 seconds more before timing out.'
        );
      });

      const data: StatusEvent = {
        sandboxProcessObj,
        interval: 30,
        remainingWait: 30,
        waitingOnAuth: false,
      };

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_STATUS, data);
    });
  });

  afterEach(() => {
    sandbox.restore();
  });
});
