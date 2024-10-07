/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { config, expect } from 'chai';
import sinon from 'sinon';
import { stubMethod } from '@salesforce/ts-sinon';
import { Messages, ScratchOrgCache, SfError } from '@salesforce/core';

import { stubSfCommandUx, stubUx } from '@salesforce/sf-plugins-core';
import OrgResumeScratch from '../../../src/commands/org/resume/scratch.js';

config.truncateThreshold = 0;

describe('org:resume:scratch', () => {
  Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
  const messages = Messages.loadMessages('@salesforce/plugin-org', 'resume_scratch');
  const sandbox = sinon.createSandbox();
  beforeEach(() => {
    stubSfCommandUx(sandbox);
    stubUx(sandbox);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('will handle a cache miss gracefully', async () => {
    stubMethod(sandbox, ScratchOrgCache, 'create').resolves({
      get: () => {},
      keys: () => {},
    });

    try {
      await OrgResumeScratch.run(['--job-id', '2SRFOOFOOFOOFOOFOO', '--json']);
      expect(false, 'ResumeSandbox should have thrown sandboxCreateNotComplete');
    } catch (err: unknown) {
      const error = err as SfError;
      expect(error.message).to.equal('The ScratchOrgInfoId 2SRFOOFOOFOOFOOFOO was not found in the cache.');
      expect(error.name).to.equal('CacheMissError');
    }
  });

  it('will handle a cache miss gracefully and change message when other keys exist', async () => {
    stubMethod(sandbox, ScratchOrgCache, 'create').resolves({
      get: () => {},
      keys: () => ['abc', '123'],
    });

    try {
      await OrgResumeScratch.run(['--job-id', '2SRFOOFOOFOOFOOFOO', '--json']);
      expect(false, 'ResumeSandbox should have thrown sandboxCreateNotComplete');
    } catch (err: unknown) {
      const error = err as SfError;
      expect(error.message).to.equal(messages.getMessage('error.jobIdMismatch', ['2SRFOOFOOFOOFOOFOO']));
      expect(error.name).to.equal('JobIdMismatchError');
    }
  });
});
