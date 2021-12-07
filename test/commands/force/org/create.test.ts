/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Aliases,
  Config,
  Lifecycle,
  Org,
  SandboxEvents,
  SandboxProcessObject,
  SandboxUserAuthResponse,
  SfdxProject,
} from '@salesforce/core';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { IConfig } from '@oclif/config';
import * as sinon from 'sinon';
import { expect } from '@salesforce/command/lib/test';
import { UX } from '@salesforce/command';
import { Duration } from '@salesforce/kit';
import { Create } from '../../../../src/commands/force/org/beta/create';

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
  let cmd: TestCreate;

  class TestCreate extends Create {
    public async runIt() {
      await this.init();
      return this.run();
    }
    public setOrg(org: Org) {
      this.org = org;
    }
    public setProject(project: SfdxProject) {
      this.project = project;
    }
  }

  const createCommand = async (params: string[]) => {
    cmd = new TestCreate(params, oclifConfigStub);
    stubMethod(sandbox, cmd, 'assignProject').callsFake(() => {
      const sfdxProjectStub = fromStub(
        stubInterface<SfdxProject>(sandbox, {
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

  describe('scratch org', () => {});

  describe('sandbox', () => {
    it('will parse the --type flag correctly to create a sandbox', async () => {
      const command = await createCommand(['--type', 'sandbox']);
      await command.runIt();
      expect(createSandboxStub.calledOnce).to.be.true;
    });

    it('will warn the user when --clientid is passed', async () => {
      const commmand = await createCommand(['--type', 'sandbox', '--clientid', '123']);
      await commmand.runIt();
      expect(uxWarnStub.calledOnce).to.be.true;
      expect(uxWarnStub.firstCall.args[0]).to.equal(
        '-i | --clientid is not supported for the sandbox org create command. Its value, 123, has been ignored.'
      );
      expect(createSandboxStub.calledOnce).to.be.true;
    });

    it('will throw an error when creating a sandbox with retry', async () => {
      try {
        const command = await createCommand(['--type', 'sandbox', '--retry', '1']);
        await command.runIt();
      } catch (e) {
        expect(e.name).to.equal('retryIsNotValidForSandboxes');
        expect(createSandboxStub.callCount).to.equal(0);
      }
    });

    it('properly overwrites options from defaults, varargs, and definition file', async () => {
      // the keys don't need to be valid sandbox definition keys
      const command = await createCommand([
        '--type',
        'sandbox',
        'license=LicenseFromVarargs',
        '--definitionfile',
        'mySandboxDef.json',
      ]);

      createSandboxStub.restore();
      stubMethod(sandbox, cmd, 'readJsonDefFile').returns({
        license: 'licenseFromJon',
        SandboxName: 'sandboxNameFromJson',
      });
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      const prodOrg = stubMethod(sandbox, Org.prototype, 'createSandbox');
      await command.runIt();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        SandboxName: 'sandboxNameFromJson',
        license: 'LicenseFromVarargs',
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
      const command = await createCommand(['--type', 'sandbox']);

      createSandboxStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'createSandbox');
      await command.runIt();

      Lifecycle.getInstance().on(SandboxEvents.EVENT_ASYNC_RESULT, async (result) => {
        expect(result).to.deep.equal(sandboxProcessObj);
        expect(uxLogStub.firstCall.args[0]).to.equal(
          'The sandbox org creation process 0GR4p000000U8EMXXX is in progress. Run "sfdx force:org:status -n TestSandbox" to check for status. If the org is ready, checking the status also authorizes the org for use with Salesforce CLI.'
        );
      });

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_ASYNC_RESULT, sandboxProcessObj);
    });

    it('will print the correct message for status lifecycle event', async () => {
      const command = await createCommand(['--type', 'sandbox']);

      createSandboxStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'createSandbox');
      await command.runIt();

      Lifecycle.getInstance().on(SandboxEvents.EVENT_STATUS, async (result) => {
        expect(result).to.deep.equal(data);
        expect(uxLogStub.firstCall.args[0]).to.equal(
          'Sandbox request TestSandbox(0GR4p000000U8EMXXX) is Completed (100% completed). Sleeping 30 seconds seconds. Will wait NaN more before timing out.'
        );
      });

      const data = {
        sandboxProcessObj,
        interval: Duration.seconds(30),
        retries: 1,
        waitingOnAuth: false,
      };

      await Lifecycle.getInstance().emit(SandboxEvents.EVENT_STATUS, data);
    });

    it('will print the correct message for result lifecycle event and set alias/defaultusername', async () => {
      const command = await createCommand(['--type', 'sandbox', '--setalias', 'sandboxAlias', '--setdefaultusername']);

      createSandboxStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'createSandbox');
      const aliasStub = stubMethod(sandbox, Aliases.prototype, 'set');
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
        expect(aliasStub.firstCall.args).to.deep.equal(['sandboxAlias', 'newSandboxUsername']);
        expect(configStub.firstCall.args).to.deep.equal(['defaultusername', 'newSandboxUsername']);
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
  });

  afterEach(() => {
    sandbox.restore();
  });
});
