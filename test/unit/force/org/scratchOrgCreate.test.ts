/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockTestOrgData, shouldThrow, TestContext } from '@salesforce/core/lib/testSetup.js';
import { SfError, Messages, Org } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import { Prompter, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { Create } from '../../../../src/commands/force/org/create.js';

Messages.importMessagesDirectory(dirname(fileURLToPath(import.meta.url)));
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

  const clientSecret = '123456';
  // stubs
  let scratchOrgCreateStub: sinon.SinonStub;
  let promptStub: sinon.SinonStub;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  const runCreateCommand = (params: string[]) => {
    // so the `exists` flag on definition file passes
    $$.SANDBOX.stub(fs, 'existsSync')
      .withArgs(sinon.match('.json'))
      .returns(true)
      // oclif/core depends on existsSync to find the root plugin so we have to
      // stub it out here to ensure that it doesn't think an invalid path is the root
      .withArgs(sinon.match('bin'))
      .returns(false);
    stubMethod($$.SANDBOX, fs.promises, 'stat').resolves({ isFile: () => true });

    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);

    return Create.run(params);
  };

  describe('scratch org', () => {
    it('will parse the --type flag correctly to create a scratchOrg', async () => {
      scratchOrgCreateStub = stubMethod($$.SANDBOX, Create.prototype, 'createScratchOrg').resolves();
      await runCreateCommand(['--type', 'scratch', '-v', testHub.username]);
      expect(scratchOrgCreateStub.callCount).to.equal(1);
    });

    it('properly sends varargs, and definition file', async () => {
      scratchOrgCreateStub = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves(CREATE_RESULT);
      await runCreateCommand([
        '--type',
        'scratch',
        'licenseType=LicenseFromVarargs',
        '--definitionfile',
        'myScratchDef.json',
        '-v',
        testHub.username,
      ]);

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
      expect(sfCommandUxStubs.log.firstCall.firstArg).to.equal(
        'Successfully created scratch org: 12345, username: sfdx-cli@salesforce.com.'
      );
    });

    it('will fail if no definitionfile or not varargs', async () => {
      try {
        await shouldThrow(runCreateCommand(['--type', 'scratch', '-v', testHub.username]));
      } catch (e) {
        const error = e as SfError;
        expect(error.message).to.equal(messages.getMessage('noConfig'));
      }
    });

    it('will prompt the user for a secret if clientId is provided', async () => {
      const connectedAppConsumerKey = 'abcdef';
      const definitionfile = 'myScratchDef.json';
      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves(CREATE_RESULT);
      promptStub = stubMethod($$.SANDBOX, Prompter.prototype, 'prompt').resolves({ clientSecret });

      await runCreateCommand([
        '--type',
        'scratch',
        '-i',
        connectedAppConsumerKey,
        '--definitionfile',
        definitionfile,
        '-v',
        testHub.username,
      ]);

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
      expect(sfCommandUxStubs.log.firstCall.firstArg).to.equal(
        'Successfully created scratch org: 12345, username: sfdx-cli@salesforce.com.'
      );
    });

    it('will set alias/defaultusername', async () => {
      const definitionfile = 'myScratchDef.json';
      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
      });

      await runCreateCommand([
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
      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
      });

      await runCreateCommand([
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

      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
      });

      const result = await runCreateCommand([
        '--type',
        'scratch',
        '--definitionfile',
        definitionfile,
        '-v',
        testHub.username,
      ]);
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

      stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves({
        ...CREATE_RESULT,
        username: 'newScratchUsername',
        warnings,
      });
      await runCreateCommand(['--type', 'scratch', '--definitionfile', definitionfile, '-v', testHub.username]);
      expect(sfCommandUxStubs.warn.callCount).to.be.greaterThanOrEqual(2);
      expect(sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args)).to.have.include(warnings[0]);
      expect(sfCommandUxStubs.warn.getCalls().flatMap((c) => c.args)).to.have.include(warnings[1]);
    });
  });

  it('should print the error if command fails', async () => {
    const errorMessage = 'MyError';
    const definitionfile = 'myScratchDef.json';
    stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').rejects(new SfError(errorMessage));
    try {
      await shouldThrow(
        runCreateCommand(['--type', 'scratch', '--definitionfile', definitionfile, '-v', testHub.username])
      );
    } catch (e) {
      const error = e as SfError;
      expect(error.message).to.equal(errorMessage);
    }
  });
});
