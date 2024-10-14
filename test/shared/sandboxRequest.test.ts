/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { SfError } from '@salesforce/core';
import { shouldThrow, TestContext } from '@salesforce/core/testSetup';
import { assert, expect } from 'chai';
import { createSandboxRequest } from '../../src/shared/sandboxRequest.js';

describe('sandboxRequest builder', () => {
  const $$ = new TestContext();

  describe('clone', () => {
    it('throws without srcSandboxName', async () => {
      try {
        await shouldThrow(
          createSandboxRequest(undefined, $$.TEST_LOGGER, {
            // SourceSandboxName: 'sbox',
            SandboxName: 'foo',
          })
        );
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
      }
    });
    it('from only varargs', async () => {
      const res = await createSandboxRequest(undefined, $$.TEST_LOGGER, {
        SourceSandboxName: 'sbox',
        SandboxName: 'foo',
        Description: 'the desc',
      });
      assert(res);
      expect(res.sandboxReq.SandboxName).equals('foo');
      expect(res.srcSandboxName).equals('sbox');
      expect(res.sandboxReq.Description).equals('the desc');
    });

    it('from only camelcase varargs', async () => {
      const res = await createSandboxRequest(undefined, $$.TEST_LOGGER, {
        SourceSandboxName: 'sbox',
        sandboxName: 'foo',
      });
      assert(res);
      expect(res.sandboxReq.SandboxName).equals('foo');
      expect(res.srcSandboxName).equals('sbox');
    });

    it('throws without srcSandboxName in the file', async () => {
      try {
        await shouldThrow(
          createSandboxRequest(undefined, $$.TEST_LOGGER, {
            SandboxName: 'foo',
          })
        );
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
      }
    });
    it('from a file with lowercase props', async () => {
      $$.SANDBOX.stub(fs, 'readFileSync').returns(
        JSON.stringify({
          sourceSandboxName: 'sbox',
          sandboxName: 'foo',
        })
      );
      const res = await createSandboxRequest('fooFile', $$.TEST_LOGGER);
      assert(res);
      expect(res.sandboxReq.SandboxName).equals('foo');
      expect(res.srcSandboxName).equals('sbox');
    });
    it('both with conflicts and varargs wins', async () => {
      $$.SANDBOX.stub(fs, 'readFileSync').returns(
        JSON.stringify({
          sourceSandboxName: 'sbox',
          sandboxName: 'foo',
        })
      );
      const res = await createSandboxRequest('fooFile', $$.TEST_LOGGER, { sandboxName: 'realName' });
      assert(res);
      expect(res.sandboxReq.SandboxName).equals('realName');
    });
  });
  describe('not clone', () => {
    it('throws without licenseType', async () => {
      try {
        await shouldThrow(
          createSandboxRequest(undefined, $$.TEST_LOGGER, {
            SandboxName: 'foo',
          })
        );
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
      }
    });
    it('from only varargs', async () => {
      const res = await createSandboxRequest(undefined, $$.TEST_LOGGER, {
        SandboxName: 'foo',
        LicenseType: 'Developer',
      });
      expect(res.sandboxReq.SandboxName).equals('foo');
      expect(res.sandboxReq.LicenseType).equals('Developer');
    });
    it('from only camelcase varargs', async () => {
      const res = await createSandboxRequest(undefined, $$.TEST_LOGGER, {
        licenseType: 'Developer',
        sandboxName: 'foo',
      });
      assert(res);
      expect(res.sandboxReq.SandboxName).equals('foo');
    });

    it('throws without licenseType in the file', async () => {
      try {
        await shouldThrow(
          createSandboxRequest(undefined, $$.TEST_LOGGER, {
            SandboxName: 'foo',
          })
        );
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
      }
    });
    it('from a file with lowercase props', async () => {
      $$.SANDBOX.stub(fs, 'readFileSync').returns(
        JSON.stringify({
          licenseType: 'Developer',
          sandboxName: 'foo',
        })
      );
      const res = await createSandboxRequest('fooFile', $$.TEST_LOGGER);
      assert(res);
      expect(res.sandboxReq.SandboxName).equals('foo');
    });
    it('both with conflicts and varargs wins', async () => {
      $$.SANDBOX.stub(fs, 'readFileSync').returns(
        JSON.stringify({
          licenseType: 'Developer',
          sandboxName: 'foo',
        })
      );
      const res = await createSandboxRequest('fooFile', $$.TEST_LOGGER, { licenseType: 'Full' });
      assert(res);
      expect(res.sandboxReq.LicenseType).equals('Full');
    });
  });
});
