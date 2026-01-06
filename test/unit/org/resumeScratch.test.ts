/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
