/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect, test } from '@salesforce/command/lib/test';
import { Org, MyDomainResolver, Messages } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
// import { SfdxError } from '../../../../../sfdx-core/lib/sfdxError';
import * as utils from '../../../../src/shared/utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'open');

const orgId = '000000000000000';
const username = 'test@test.org';
const testPath = '/lightning/whatever';
const testInstance = 'https://cs1.my.salesforce.com';
const accessToken = 'testAccessToken';
const expectedDefaultUrl = `${testInstance}/secur/frontdoor.jsp?sid=${accessToken}`;
const expectedUrl = `${expectedDefaultUrl}&retURL=${encodeURIComponent(testPath)}`;

const testJsonStructure = (response: Record<string, unknown>) => {
  expect(response).to.have.property('url');
  expect(response).to.have.property('username').equal(username);
  expect(response).to.have.property('orgId').equal(orgId);
  return true;
};

describe('open commands', () => {
  const spies = new Map();
  afterEach(() => spies.clear());

  beforeEach(async function () {
    $$.SANDBOX.restore();
    stubMethod($$.SANDBOX, Org, 'create').resolves(Org.prototype);
    stubMethod($$.SANDBOX, Org.prototype, 'getField').withArgs(Org.Fields.INSTANCE_URL).returns(testInstance);
    stubMethod($$.SANDBOX, Org.prototype, 'refreshAuth').resolves({});
    stubMethod($$.SANDBOX, Org.prototype, 'getOrgId').returns(orgId);
    stubMethod($$.SANDBOX, Org.prototype, 'getUsername').returns(username);
    stubMethod($$.SANDBOX, Org.prototype, 'getConnection').returns({
      accessToken,
    });
    spies.set('open', stubMethod($$.SANDBOX, utils, 'openUrl').resolves());
  });

  describe('url generation', () => {
    test
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', username, '--urlonly'])
      .it('org without a url defaults to proper default', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url).to.equal(expectedDefaultUrl);
      });

    test
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', username, '--urlonly', '--path', testPath])
      .it('org with a url is built correctly', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url).to.equal(expectedUrl);
      });

    test
      .do(() => {
        process.env.FORCE_OPEN_URL = testPath;
      })
      .finally(() => {
        delete process.env.FORCE_OPEN_URL;
      })
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', username, '--urlonly'])
      .it('can read url from env', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url).to.equal(expectedUrl);
      });
  });

  describe('domain resolution, with callout', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, MyDomainResolver, 'create').resolves(MyDomainResolver.prototype);
    });
    test
      .do(() => {
        spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));
      })
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', username, '--path', testPath])
      .it('waits on domains that need time to resolve', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url).to.equal(expectedUrl);

        expect(spies.get('resolver').callCount).to.equal(1);
      });

    test
      .do(() => {
        spies.set(
          'resolver',
          stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').throws({ message: 'timeout' })
        );
      })
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', username, '--path', testPath])
      .it('handles domain timeouts', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(spies.get('resolver').callCount).to.equal(1);
        expect(spies.get('open').callCount).to.equal(0);
        expect(response.status).to.equal(1);
        expect(response.message).to.equal(messages.getMessage('domainTimeoutError'));
      });
  });

  describe('domain resolution, no callout', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, MyDomainResolver, 'create').resolves(MyDomainResolver.prototype);
      spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));
    });
    it('does not wait for domains on internal urls');

    test
      .do(() => {
        process.env.SFDX_CONTAINER_MODE = 'true';
      })
      .finally(() => {
        delete process.env.SFDX_CONTAINER_MODE;
      })
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', username, '--path', testPath])
      .it('does not wait for domains in container mode, even without urlonly', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url).to.equal(expectedUrl);

        expect(spies.get('resolver').callCount).to.equal(0);
      });

    test
      .do(() => {
        process.env.SFDX_DOMAIN_RETRY = '0';
      })
      .finally(() => {
        delete process.env.SFDX_DOMAIN_RETRY;
      })
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', username, '--path', testPath])
      .it('does not wait for domains when timeouts are zero, even without urlonly', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(spies.get('resolver').callCount).to.equal(0);
      });
  });

  describe('human output', () => {
    test
      .do(() => {
        spies.set('resolver', stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').resolves('1.1.1.1'));
      })
      .stdout()
      .command(['force:org:open', '--targetusername', username, '--path', testPath])
      .it('calls open and outputs proper success message', (ctx) => {
        expect(ctx.stdout).to.include(messages.getMessage('humanSuccess', [orgId, username, expectedUrl]));
        expect(spies.get('resolver').callCount).to.equal(1);
        expect(spies.get('open').callCount).to.equal(1);
      });

    test
      .do(() => {
        spies.set(
          'resolver',
          stubMethod($$.SANDBOX, MyDomainResolver.prototype, 'resolve').throws({ message: 'timeout' })
        );
      })
      .stderr()
      .command(['force:org:open', '--targetusername', username, '--path', testPath])
      .it('throws on dns fail', (ctx) => {
        expect(ctx.stderr).to.contain(messages.getMessage('domainTimeoutError'));
        expect(spies.get('resolver').callCount).to.equal(1);
        expect(spies.get('open').callCount).to.equal(0);
      });
  });
});
