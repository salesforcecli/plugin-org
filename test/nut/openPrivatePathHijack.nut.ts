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

import { platform, tmpdir } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { type ExecFileFn, getWindowsPrivateBrowserApp } from '../../src/shared/orgOpenUtils.js';

describe('W-23807283: reg.exe PATH hijack prevention (Windows only)', () => {
  if (platform() !== 'win32') {
    it.skip('skipped on non-Windows', () => {});
    return;
  }

  const evidenceFile = path.join(tmpdir(), `path-hijack-evidence-${process.pid}.txt`);

  afterEach(() => {
    try {
      fs.unlinkSync(evidenceFile);
    } catch {
      // file may not exist
    }
  });

  it('uses a fully-qualified reg.exe path, not bare "reg"', async () => {
    let capturedCommand = '';

    const interceptExec: ExecFileFn = async (cmd) => {
      capturedCommand = cmd;
      return { stdout: '    ProgId    REG_SZ    ChromeHTML\r\n' };
    };

    await getWindowsPrivateBrowserApp(interceptExec);

    expect(capturedCommand).to.match(/[A-Z]:\\.*\\System32\\reg\.exe$/i);
    expect(capturedCommand).to.not.equal('reg');
    expect(capturedCommand).to.not.equal('reg.exe');
  });

  it('a project-local reg.exe in PATH does not execute during browser detection', async () => {
    const poisonDir = path.join(tmpdir(), `hijack-test-${process.pid}`);
    const poisonBin = path.join(poisonDir, 'node_modules', '.bin');
    fs.mkdirSync(poisonBin, { recursive: true });

    fs.writeFileSync(
      path.join(poisonBin, 'reg.exe'),
      `@echo off\r\necho HIJACKED > "${evidenceFile}"\r\necho     ProgId    REG_SZ    ChromeHTML\r\n`
    );

    const originalPath = process.env.PATH;
    process.env.PATH = `${poisonBin};${originalPath}`;

    try {
      await getWindowsPrivateBrowserApp();
      expect(fs.existsSync(evidenceFile), 'Malicious reg.exe should NOT have been executed').to.be.false;
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(poisonDir, { recursive: true, force: true });
    }
  });
});
