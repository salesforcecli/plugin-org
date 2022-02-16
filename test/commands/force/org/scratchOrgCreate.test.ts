/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, Config, SfdxError, Messages, Org, SfdxProject } from '@salesforce/core';
import { fromStub, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { expect, IConfig } from '@salesforce/command/lib/test';
import { UX } from '@salesforce/command';
import { assert } from 'sinon';
import { Create } from '../../../../src/commands/force/org/beta/create';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'create');

const CREATE_RESULT = {
  username: 'sfdx-cli@salesforce.com',
  scratchOrgInfo: {},
  authFields: {
    accessToken: '1234',
    clientId: '1234',
    created: '2022-01-01',
    createdOrgInstance: 'instance',
    devHubUsername: 'sfdx-cli@salesforce.com',
    expirationDate: '2021-01-01',
    instanceUrl: 'https://instance.salesforce.com',
    loginUrl: 'https://login.salesforce.com',
    orgId: '12345',
    username: 'sfdx-cli@salesforce.com',
  },
  warnings: [],
};

describe('org:create', () => {
  const sandbox = sinon.createSandbox();
  const oclifConfigStub = fromStub(stubInterface<IConfig.IConfig>(sandbox));
  const clientSecret = '123456';
  // stubs
  let resolveProjectConfigStub: sinon.SinonStub;
  let scratchOrgCreateStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  let uxWarnStub: sinon.SinonStub;
  let promptStub: sinon.SinonStub;
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

  const createCommand = (params: string[]) => {
    cmd = new TestCreate(params, oclifConfigStub);
    stubMethod(sandbox, cmd, 'assignProject').callsFake(() => {
      const sfdxProjectStub = fromStub(
        stubInterface<SfdxProject>(sandbox, {
          resolveProjectConfig: resolveProjectConfigStub,
        })
      );
      cmd.setProject(sfdxProjectStub);
    });

    scratchOrgCreateStub = stubMethod(sandbox, cmd, 'createScratchOrg').resolves();

    uxLogStub = stubMethod(sandbox, UX.prototype, 'log');
    uxWarnStub = stubMethod(sandbox, UX.prototype, 'warn');
    promptStub = stubMethod(sandbox, UX.prototype, 'prompt').returns(clientSecret);
    stubMethod(sandbox, cmd, 'assignOrg').callsFake(() => {
      const orgStubOptions = {};

      const orgStub = fromStub(stubInterface<Org>(sandbox, orgStubOptions));
      cmd.setOrg(orgStub);
    });
    return cmd;
  };

  describe('sandbox', () => {
    it('will parse the --type flag correctly to create a scratchOrg', async () => {
      const command = createCommand(['--type', 'scratch', '-u', 'testProdOrg']);
      await command.runIt();
      expect(scratchOrgCreateStub.calledOnce).to.be.true;
    });

    it('properly sends varargs, and definition file', async () => {
      const command = createCommand([
        '--type',
        'scratch',
        'licenseType=LicenseFromVarargs',
        '--definitionfile',
        'myScratchDef.json',
        '-u',
        'testProdOrg',
      ]);

      scratchOrgCreateStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      const prodOrg = stubMethod(sandbox, Org.prototype, 'scratchOrgCreate').resolves(CREATE_RESULT);
      await command.runIt();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        apiversion: undefined,
        clientSecret: undefined,
        connectedAppConsumerKey: undefined,
        durationDays: undefined,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        definitionfile: 'myScratchDef.json',
        orgConfig: {
          licenseType: 'LicenseFromVarargs',
        },
      });
      expect(uxLogStub.firstCall.firstArg).to.equal(
        'Successfully created scratch org: 12345, username: sfdx-cli@salesforce.com.'
      );
    });

    it('will fail if no definitionfile or not varargs', async () => {
      const command = createCommand(['--type', 'scratch', '-u', 'testProdOrg']);

      scratchOrgCreateStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      try {
        await command.runIt();
        assert.fail('the above should throw an error');
      } catch (e) {
        expect(e.message).to.equal(messages.getMessage('noConfig'));
      }
    });

    it('will prompt the user for a secret if clientId is provided', async () => {
      const connectedAppConsumerKey = 'abcdef';
      const definitionfile = 'myScratchDef.json';
      const command = createCommand([
        '--type',
        'scratch',
        '-i',
        connectedAppConsumerKey,
        '--definitionfile',
        definitionfile,
        '-u',
        'testProdOrg',
      ]);
      scratchOrgCreateStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      const prodOrg = stubMethod(sandbox, Org.prototype, 'scratchOrgCreate').resolves(CREATE_RESULT);
      await command.runIt();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        apiversion: undefined,
        clientSecret,
        connectedAppConsumerKey,
        definitionfile,
        durationDays: undefined,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        orgConfig: {},
      });
      expect(promptStub.callCount).to.equal(1);
      expect(uxLogStub.firstCall.firstArg).to.equal(
        'Successfully created scratch org: 12345, username: sfdx-cli@salesforce.com.'
      );
    });

    it('will set alias/defaultusername', async () => {
      const definitionfile = 'myScratchDef.json';
      const command = createCommand([
        '--type',
        'scratch',
        '--setalias',
        'sandboxAlias',
        '--setdefaultusername',
        '--definitionfile',
        definitionfile,
        '-u',
        'testProdOrg',
      ]);

      scratchOrgCreateStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      const prodOrg = stubMethod(sandbox, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
      });
      const aliasStub = stubMethod(sandbox, Aliases.prototype, 'set');
      const setStub = sandbox.spy();
      const writeStub = sandbox.spy();
      const configCreateStub = stubMethod(sandbox, Config, 'create').withArgs({ isGlobal: false }).resolves({
        set: setStub,
        write: writeStub,
      });
      await command.runIt();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        apiversion: undefined,
        clientSecret: undefined,
        connectedAppConsumerKey: undefined,
        definitionfile,
        durationDays: undefined,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        orgConfig: {},
      });
      expect(aliasStub.firstCall.args).to.deep.equal(['sandboxAlias', 'newScratchUsername']);
      expect(configCreateStub.calledOnce).to.be.true;
      expect(writeStub.calledOnce).to.be.true;
      expect(configCreateStub.firstCall.firstArg).to.deep.equal({ isGlobal: false });
      expect(setStub.firstCall.args).to.deep.equal(['defaultusername', 'newScratchUsername']);
    });

    it('will test json output', async () => {
      const definitionfile = 'myScratchDef.json';
      const command = createCommand(['--type', 'scratch', '--definitionfile', definitionfile, '-u', 'testProdOrg']);

      scratchOrgCreateStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      const prodOrg = stubMethod(sandbox, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
      });
      const result = await command.runIt();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        apiversion: undefined,
        clientSecret: undefined,
        connectedAppConsumerKey: undefined,
        definitionfile,
        durationDays: undefined,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        orgConfig: {},
      });
      expect(result).to.have.keys(['username', 'authFields', 'scratchOrgInfo', 'warnings', 'orgId']);
    });

    it('will print warnings if any', async () => {
      const definitionfile = 'myScratchDef.json';
      const warnings = ['warning1', 'warning2'];
      const command = createCommand(['--type', 'scratch', '--definitionfile', definitionfile, '-u', 'testProdOrg']);

      scratchOrgCreateStub.restore();
      stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
      stubMethod(sandbox, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
        warnings,
      });
      await command.runIt();
      expect(uxWarnStub.callCount).to.equal(2);
      expect(uxWarnStub.firstCall.firstArg).to.equal(warnings[0]);
      expect(uxWarnStub.secondCall.firstArg).to.equal(warnings[1]);
    });
  });

  it('should print the error if command fails', async () => {
    const errorMessage = 'MyError';
    const definitionfile = 'myScratchDef.json';
    const command = createCommand(['--type', 'scratch', '--definitionfile', definitionfile, '-u', 'testProdOrg']);

    scratchOrgCreateStub.restore();
    stubMethod(sandbox, Org, 'create').resolves(Org.prototype);
    stubMethod(sandbox, Org.prototype, 'scratchOrgCreate').rejects(new SfdxError(errorMessage));
    try {
      await command.runIt();
      assert.fail('the above should throw an error');
    } catch (e) {
      expect(e.message).to.equal(errorMessage);
    }
  });

  afterEach(() => {
    sandbox.restore();
  });
});
