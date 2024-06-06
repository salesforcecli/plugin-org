/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { MockTestOrgData, shouldThrow, TestContext } from '@salesforce/core/testSetup';
import { SfError, Messages, Org } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import { stubPrompter, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { Create } from '../../../../src/commands/force/org/create.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
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

describe('[DEPRECATED] force:org:create', () => {
  const $$ = new TestContext();
  const testHub = new MockTestOrgData();
  testHub.isDevHub = true;

  const clientSecret = '123456';
  // stubs
  let promptStubs: ReturnType<typeof stubPrompter>;
  let sfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;

  let scratchOrgCreateStub: sinon.SinonStub;

  beforeEach(async () => {
    await $$.stubAuths(testHub);
    $$.stubAliases({});
    await $$.stubConfig({ defaultdevhubusername: testHub.username });
    promptStubs = stubPrompter($$.SANDBOX);
    sfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
    $$.SANDBOX.stub(fs.promises, 'stat')
      // isFile is for the definition file, isDirectory is for somethign oclif/core/cosmicConf is doing with pjson stacktrace
      /**
       * at isDirectory (node_modules/@oclif/core/node_modules/cosmiconfig/src/util.ts:59:17)
      at async search (node_modules/@oclif/core/node_modules/cosmiconfig/src/Explorer.ts:55:11)
      at async Explorer.search (node_modules/@oclif/core/node_modules/cosmiconfig/src/Explorer.ts:93:14)
      at async readPjson (node_modules/@oclif/core/lib/util/read-pjson.js:49:20)
      at async Plugin.load (node_modules/@oclif/core/lib/config/plugin.js:183:45)
      at async PluginLoader.loadRoot (node_modules/@oclif/core/lib/config/plugin-loader.js:43:13)
      at async Config.load (node_modules/@oclif/core/lib/config/config.js:280:27)
      at async Function.load (node_modules/@oclif/core/lib/config/config.js:167:9)
      at async Function.run (node_modules/@oclif/core/lib/command.js:150:24)
      at async Context.<anonymous> (file:///Users/shane.mclaughlin/eng/salesforcecli/plugin-org/test/unit/force/org/scratchOrgCreate.test.ts:233:28)
       */
      // @ts-expect-error incomplete stub
      .resolves({ isFile: () => true, isDirectory: () => true });
  });

  describe('scratch org', () => {
    it('will parse the --type flag correctly to create a scratchOrg', async () => {
      scratchOrgCreateStub = stubMethod($$.SANDBOX, Create.prototype, 'createScratchOrg').resolves();
      await Create.run(['--type', 'scratch', '-v', testHub.username]);
      expect(scratchOrgCreateStub.callCount).to.equal(1);
    });

    it('properly sends varargs, and definition file', async () => {
      scratchOrgCreateStub = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves(CREATE_RESULT);
      await Create.run([
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
        await shouldThrow(Create.run(['--type', 'scratch', '-v', testHub.username]));
      } catch (e) {
        const error = e as SfError;
        expect(error.message).to.equal(messages.getMessage('noConfig'));
      }
    });

    it('will prompt the user for a secret if clientId is provided', async () => {
      const connectedAppConsumerKey = 'abcdef';
      const definitionfile = 'myScratchDef.json';
      const prodOrg = stubMethod($$.SANDBOX, Org.prototype, 'scratchOrgCreate').resolves(CREATE_RESULT);
      promptStubs.secret.resolves(clientSecret);

      await Create.run([
        '--type',
        'scratch',
        '-i',
        connectedAppConsumerKey,
        '--definitionfile',
        definitionfile,
        '-v',
        testHub.username,
      ]);

      expect(promptStubs.secret.callCount).to.equal(1);
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

      await Create.run([
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

      await Create.run([
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

      const result = await Create.run([
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
      await Create.run(['--type', 'scratch', '--definitionfile', definitionfile, '-v', testHub.username]);
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
      await shouldThrow(Create.run(['--type', 'scratch', '--definitionfile', definitionfile, '-v', testHub.username]));
    } catch (e) {
      const error = e as SfError;
      expect(error.message).to.equal(errorMessage);
    }
  });
});
