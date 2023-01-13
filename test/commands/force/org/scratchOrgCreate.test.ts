/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import {
  MockTestOrgData,
  shouldThrow,
  // shouldThrow,
  TestContext,
} from '@salesforce/core/lib/testSetup';
import { SfError, Messages, Org } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { assert, expect } from 'chai';
import { Config as IConfig } from '@oclif/core';
import { Create } from '../../../../src/commands/force/org/create';

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
  const $$ = new TestContext();
  const testHub = new MockTestOrgData();
  testHub.isDevHub = true;

  beforeEach(async () => {
    await $$.stubAuths(testHub);
    $$.stubAliases({});
    await $$.stubConfig({ defaultdevhubusername: testHub.username });
  });
  afterEach(() => {
    $$.restore();
  });
  const clientSecret = '123456';
  // stubs
  let scratchOrgCreateStub: sinon.SinonStub;
  let uxLogStub: sinon.SinonStub;
  let uxWarnStub: sinon.SinonStub;
  let promptStub: sinon.SinonStub;

  const getCreateCommand = (params: string[]): Create => {
    const cmd = new Create(params, {} as IConfig);

    // so the `exists` flag on definition file passes
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    stubMethod($$.SANDBOX, fs.promises, 'stat').resolves({ isFile: () => true });
    uxLogStub = $$.SANDBOX.stub(cmd, 'log');
    uxWarnStub = $$.SANDBOX.stub(cmd, 'warn');
    return cmd;
  };

  describe('scratch org', () => {
    it('will parse the --type flag correctly to create a scratchOrg', async () => {
      const cmd = getCreateCommand(['--type', 'scratch', '-v', testHub.username]);
      scratchOrgCreateStub = stubMethod($$.SANDBOX, cmd, 'createScratchOrg').resolves();
      await cmd.run();
      expect(scratchOrgCreateStub.callCount).to.equal(1);
    });

    it('properly sends varargs, and definition file', async () => {
      scratchOrgCreateStub = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves(CREATE_RESULT);
      const cmd = getCreateCommand([
        '--type',
        'scratch',
        'licenseType=LicenseFromVarargs',
        '--definitionfile',
        'myScratchDef.json',
        '-v',
        testHub.username,
      ]);
      await cmd.run();
      expect(scratchOrgCreateStub.callCount).to.equal(1);
      expect(scratchOrgCreateStub.firstCall.args[0]).to.deep.equal({
        alias: undefined,
        apiversion: undefined,
        clientSecret: undefined,
        connectedAppConsumerKey: undefined,
        durationDays: 7,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        setDefault: false,
        tracksSource: true,
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
      const cmd = getCreateCommand(['--type', 'scratch', '-v', testHub.username]);
      try {
        await shouldThrow(cmd.run());
      } catch (e) {
        assert(e instanceof SfError);
        expect(e.message).to.equal(messages.getMessage('noConfig'));
      }
    });

    it('will prompt the user for a secret if clientId is provided', async () => {
      const connectedAppConsumerKey = 'abcdef';
      const definitionfile = 'myScratchDef.json';
      const cmd = getCreateCommand([
        '--type',
        'scratch',
        '-i',
        connectedAppConsumerKey,
        '--definitionfile',
        definitionfile,
        '-v',
        testHub.username,
      ]);
      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves(CREATE_RESULT);
      promptStub = stubMethod($$.SANDBOX, cmd, 'prompt').resolves({ clientSecret });

      await cmd.run();
      expect(promptStub.callCount).to.equal(1);
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        alias: undefined,
        apiversion: undefined,
        clientSecret,
        connectedAppConsumerKey,
        definitionfile,
        durationDays: 7,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        setDefault: false,
        tracksSource: true,
        orgConfig: {},
      });
      expect(promptStub.callCount).to.equal(1);
      expect(promptStub.callCount).to.equal(1);
      expect(uxLogStub.firstCall.firstArg).to.equal(
        'Successfully created scratch org: 12345, username: sfdx-cli@salesforce.com.'
      );
    });

    it('will set alias/defaultusername', async () => {
      const definitionfile = 'myScratchDef.json';
      const cmd = getCreateCommand([
        '--type',
        'scratch',
        '--setalias',
        'scratchOrgAlias',
        '--setdefaultusername',
        '--definitionfile',
        definitionfile,
        '-v',
        testHub.username,
      ]);

      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
      });
      await cmd.run();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        alias: 'scratchOrgAlias',
        apiversion: undefined,
        clientSecret: undefined,
        connectedAppConsumerKey: undefined,
        definitionfile,
        durationDays: 7,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        setDefault: true,
        tracksSource: true,
        orgConfig: {},
      });
    });

    it('will set alias as default', async () => {
      const definitionfile = 'myScratchDef.json';
      const cmd = getCreateCommand([
        '--type',
        'scratch',
        '--setalias',
        'scratchOrgAlias',
        '--setdefaultusername',
        '--definitionfile',
        definitionfile,
        '-v',
        testHub.username,
      ]);

      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
      });

      await cmd.run();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        alias: 'scratchOrgAlias',
        apiversion: undefined,
        clientSecret: undefined,
        connectedAppConsumerKey: undefined,
        definitionfile,
        durationDays: 7,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        orgConfig: {},
        setDefault: true,
        tracksSource: true,
      });
    });

    it('will test json output', async () => {
      const definitionfile = 'myScratchDef.json';
      const cmd = getCreateCommand(['--type', 'scratch', '--definitionfile', definitionfile, '-v', testHub.username]);

      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
      });
      const result = await cmd.run();
      expect(prodOrg.firstCall.args[0]).to.deep.equal({
        alias: undefined,
        apiversion: undefined,
        clientSecret: undefined,
        connectedAppConsumerKey: undefined,
        definitionfile,
        durationDays: 7,
        noancestors: undefined,
        nonamespace: undefined,
        wait: {
          quantity: 6,
          unit: 0,
        },
        retry: 0,
        tracksSource: true,
        setDefault: false,
        orgConfig: {},
      });
      expect(result).to.have.keys(['username', 'authFields', 'scratchOrgInfo', 'warnings', 'orgId']);
    });

    it('will print warnings if any', async () => {
      const definitionfile = 'myScratchDef.json';
      const warnings = ['warning1', 'warning2'];
      const cmd = getCreateCommand(['--type', 'scratch', '--definitionfile', definitionfile, '-v', testHub.username]);

      stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
        warnings,
      });
      await cmd.run();
      expect(uxWarnStub.callCount).to.equal(2);
      expect(uxWarnStub.callCount).to.equal(2);
      expect(uxWarnStub.firstCall.firstArg).to.equal(warnings[0]);
      expect(uxWarnStub.firstCall.firstArg).to.equal(warnings[0]);
      expect(uxWarnStub.secondCall.firstArg).to.equal(warnings[1]);
      expect(uxWarnStub.secondCall.firstArg).to.equal(warnings[1]);
    });
  });

  it('should print the error if command fails', async () => {
    const errorMessage = 'MyError';
    const definitionfile = 'myScratchDef.json';
    const cmd = getCreateCommand(['--type', 'scratch', '--definitionfile', definitionfile, '-v', testHub.username]);

    stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').rejects(new SfError(errorMessage));
    try {
      await cmd.run();
      assert.fail('the above should throw an error');
    } catch (e) {
      assert(e instanceof SfError);
      expect(e.message).to.equal(errorMessage);
    }
  });
});
