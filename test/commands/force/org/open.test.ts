/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect, test } from '@salesforce/command/lib/test';
import { Org, MyDomainResolver } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import * as utils from '../../../../src/shared/utils';

const testJsonStructure = (response: object) => {
  expect(response).to.have.property('url');
  expect(response).to.have.property('username');
  expect(response).to.have.property('orgId');
  return true;
};

describe('open commands', () => {
  beforeEach(async function () {
    $$.SANDBOX.restore();
    stubMethod($$.SANDBOX, Org, 'create').resolves(Org.prototype);
    stubMethod($$.SANDBOX, Org.prototype, 'getField')
      .withArgs(Org.Fields.INSTANCE_URL)
      .returns('https://cs1.my.salesforce.com');
    stubMethod($$.SANDBOX, Org.prototype, 'refreshAuth').resolves({});
    stubMethod($$.SANDBOX, Org.prototype, 'getOrgId').returns('testOrgId');
    stubMethod($$.SANDBOX, Org.prototype, 'getUsername').returns('test@test.org');
    stubMethod($$.SANDBOX, Org.prototype, 'getConnection').returns({
      accessToken: 'testAccessToken',
    });
    stubMethod($$.SANDBOX, utils, 'openUrl').resolves();
  });

  describe('url generation', () => {
    test
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', 'test@test.org', '--urlonly'])
      .it('org without a url defaults to proper default', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
      });

    test
      .stdout()
      .command([
        'force:org:open',
        '--json',
        '--targetusername',
        'test@test.org',
        '--urlonly',
        '--path',
        '/lightning/whatever',
      ])
      .it('org with a url is built correctly', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url.endsWith(encodeURIComponent('/lightning/whatever'))).to.be.true;
      });

    it('returns proper url when instanceUrl has trailing slash');
  });

  describe('domain resolution', () => {
    const spies = new Map();
    afterEach(() => spies.clear());

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
      .command(['force:org:open', '--json', '--targetusername', 'test@test.org', '--path', '/lightning/whatever'])
      .it('does not wait for domains in container mode, even without urlonly', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url.endsWith(encodeURIComponent('/lightning/whatever'))).to.be.true;
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
      .command(['force:org:open', '--json', '--targetusername', 'test@test.org', '--path', '/lightning/whatever'])
      .it('does not wait for domains when timeouts are zero, even without urlonly', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url.endsWith(encodeURIComponent('/lightning/whatever'))).to.be.true;
        expect(spies.get('resolver').callCount).to.equal(0);
      });

    test
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', 'test@test.org', '--path', '/lightning/whatever'])
      .it('waits on domains that need time to resolve', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url.endsWith(encodeURIComponent('/lightning/whatever'))).to.be.true;
        expect(spies.get('resolver').callCount).to.equal(1);
      });

    test
      .stdout()
      .command(['force:org:open', '--json', '--targetusername', 'test@test.org', '--path', '/lightning/whatever'])
      .it('handles domain timeouts', (ctx) => {
        const response = JSON.parse(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(testJsonStructure(response.result)).to.be.true;
        expect(response.result.url.endsWith(encodeURIComponent('/lightning/whatever'))).to.be.true;
        expect(spies.get('resolver').callCount).to.equal(1);
      });
  });

  it('calls open when urlonly is not present');
});
