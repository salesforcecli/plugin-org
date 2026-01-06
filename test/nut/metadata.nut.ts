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
import path from 'node:path';
import fs from 'node:fs';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import type { DescribeMetadataResult } from '@jsforce/jsforce-node/lib/api/metadata/schema.js';
import type { ListMetadataCommandResult } from '../../src/commands/org/list/metadata.js';

describe('org list metadata*', () => {
  let session: TestSession;
  before(async () => {
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc.git',
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          config: path.join('config', 'project-scratch-def.json'),
          setDefault: true,
          duration: 1,
        },
      ],
    });
    execCmd('project:deploy:start -d force-app');
  });

  after(async () => {
    await session?.zip(undefined, 'artifacts');
    await session?.clean();
  });

  describe('list metadata', () => {
    it('should successfully execute list metadata for type CustomObject', () => {
      const result = execCmd<ListMetadataCommandResult>(
        'org:list:metadata -f output --json --metadatatype CustomObject'
      ).jsonOutput;
      expect(result?.status).to.equal(0);
      expect(result?.result).to.be.an('array').with.length.greaterThan(3);
      expect(result?.result[0]).to.have.property('type', 'CustomObject');
      expect(fs.existsSync(path.join(session.project.dir, 'output'))).to.equal(true);
    });

    it('should successfully execute list metadata for type ListView', () => {
      // ListView is sensitive to how the connection.metadata.list() call is made.
      // e.g., if you pass { type: 'ListView', folder: undefined } it will not return
      // any ListViews but if you pass { type: 'ListView' } it returns all ListViews.
      const result = execCmd<ListMetadataCommandResult>('org:list:metadata --json --metadatatype ListView').jsonOutput;
      expect(result?.status).to.equal(0);
      expect(result?.result).to.be.an('array').with.length.greaterThan(10);
      expect(result?.result[0]).to.have.property('type', 'ListView');
    });
  });

  describe('list metadata-types', () => {
    it('should successfully execute describemetadata', () => {
      const result = execCmd<DescribeMetadataResult>('org:list:metadata-types --json --resultfile md-describe.json', {
        ensureExitCode: 0,
      }).jsonOutput;
      const json = result?.result;
      expect(json).to.have.property('metadataObjects');
      const mdObjects = json?.metadataObjects;
      expect(mdObjects).to.be.an('array').with.length.greaterThan(100);
      const customLabelsDef = mdObjects?.find((md) => md.xmlName === 'CustomLabels');
      expect(customLabelsDef).to.deep.equal({
        childXmlNames: ['CustomLabel'],
        directoryName: 'labels',
        inFolder: false,
        metaFile: false,
        suffix: 'labels',
        xmlName: 'CustomLabels',
      });
      expect(fs.existsSync(path.join(session.project.dir, 'md-describe.json'))).to.be.true;
    });
  });
});
