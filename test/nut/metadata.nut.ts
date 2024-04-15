/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import fs from 'node:fs';
import { expect } from 'chai';
import { execCmd, TestSession, genUniqueString } from '@salesforce/cli-plugins-testkit';
import type { DescribeMetadataResult } from '@jsforce/jsforce-node/lib/api/metadata/schema.js';
import type { ListMetadataCommandResult } from '../../src/commands/org/list/metadata.js';

describe('org list metadata*', () => {
  let session: TestSession;
  before(async () => {
    const uid = genUniqueString('listMetadata_%s');
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc.git',
      },
      sessionDir: path.join(process.cwd(), `test_session_${uid}`),
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
