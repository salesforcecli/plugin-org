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

import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Messages } from '@salesforce/core';
import { OrgEnableTrackingResult } from '../../src/commands/org/enable/tracking.js';
import { OrgDisableTrackingResult } from '../../src/commands/org/disable/tracking.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'org.enable.tracking');

describe('org enable/disable tracking NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      project: { name: 'orgEnableDisableTrackingNut' },
      scratchOrgs: [{ setDefault: true, edition: 'developer' }],
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('should disable on scratch org', () => {
    const result = execCmd<OrgDisableTrackingResult>('org disable tracking --json', { ensureExitCode: 0 }).jsonOutput
      ?.result;
    expect(result?.tracksSource).to.equal(false);
    expect(result?.username).to.equal(session.orgs.get('default')?.username);
  });

  it('should disable on scratch org (idempotency)', () => {
    const result = execCmd<OrgDisableTrackingResult>('org disable tracking --json', { ensureExitCode: 0 }).jsonOutput
      ?.result;
    expect(result?.tracksSource).to.equal(false);
    expect(result?.username).to.equal(session.orgs.get('default')?.username);
  });

  it('should re-enable on scratch org', () => {
    const result = execCmd<OrgEnableTrackingResult>('org enable tracking --json', { ensureExitCode: 0 }).jsonOutput
      ?.result;
    expect(result?.tracksSource).to.equal(true);
    expect(result?.username).to.equal(session.orgs.get('default')?.username);
  });

  it('should enable on scratch org (idempotency)', () => {
    const result = execCmd<OrgEnableTrackingResult>('org enable tracking --json', { ensureExitCode: 0 }).jsonOutput
      ?.result;
    expect(result?.tracksSource).to.equal(true);
    expect(result?.username).to.equal(session.orgs.get('default')?.username);
  });

  it('should disable on hub org (idempotency)', () => {
    const result = execCmd<OrgDisableTrackingResult>(`org disable tracking -o ${session.hubOrg.username} --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    expect(result?.tracksSource).to.equal(false);
    expect(result?.username).to.equal(session.hubOrg.username);
  });

  it('should fail to enable on hub org', () => {
    const err = execCmd<OrgDisableTrackingResult>(`org enable tracking -o ${session.hubOrg.username}`, {
      ensureExitCode: 1,
    });
    expect(err?.shellOutput.stderr).to.include(messages.getMessage('error.TrackingNotAvailable'));
  });
});
