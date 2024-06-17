/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
