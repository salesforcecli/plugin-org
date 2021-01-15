/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect, test } from '@salesforce/command/lib/test';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

// import * as BBPromise from 'bluebird';
import {
  AuthInfo,
  // Connection
} from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
// import * as cliTestHelper from '../../cliTestHelper';

// import * as Force from '../../../lib/core/force';
import OrgListMock = require('../../../shared/orgListMock');
// import * as TestWorkspace from '../../TestWorkspace';
import { OrgListUtil } from '../../../../src/shared/orgListUtil';

// let workspace;
// let sandbox: sinon.SinonSandbox;

// class ListCommand extends OrgListCommand {
//   private _ux = { styledHeader: () => {}, table: () => {}, log: () => {}, prompt: () => {}, warn: () => {} };
//   public get ux() {
//     return this._ux as any;
//   }
//   public printOrgTable(data) {
//     return super.printOrgTable(data, this.flags.skipconnectionstatus);
//   }
// }

// const listCommand = new ListCommand(null, null);

describe('org_list', () => {
  beforeEach(async () => {
    stubMethod($$.SANDBOX, AuthInfo, 'listAllAuthFiles');
    // stubMethod($$.SANDBOX, Connection.prototype, 'describeData').resolves({});
  });
  afterEach(() => {
    $$.SANDBOX.restore();
  });

  describe('hub org defined', () => {
    beforeEach(async () => {
      // await workspace.configureHubOrg();
      stubMethod($$.SANDBOX, OrgListUtil, 'readLocallyValidatedMetaConfigsGroupedByOrgType').resolves(
        OrgListMock.AUTH_INFO
      );
    });

    afterEach(async () => {
      $$.SANDBOX.restore();
    });

    test
      .stdout()
      .command(['force:org:list', '--json'])
      .it('should list active orgs', (ctx) => {
        const orgs = JSON.parse(ctx.stdout).result;
        expect(orgs.nonScratchOrgs.length).to.equal(1);
        expect(orgs.nonScratchOrgs[0].username).to.equal('foo@example.com');
        expect(orgs.nonScratchOrgs[0].isDevHub).to.equal(true);
        expect(orgs.scratchOrgs.length).to.equal(2); // there are two orgs non-expired
      });

    test
      .stdout()
      .command(['force:org:list', '--json', '--all'])
      .it('should list all orgs', (ctx) => {
        const orgs = JSON.parse(ctx.stdout).result;
        expect(orgs.scratchOrgs.length).to.equal(4); // there are 4 orgs total
      });
  });

  // describe('all option', () => {
  //   it('all not set -- only active orgs', async () => {
  //     OrgListMock.retrieveAuthInfo(sandbox);
  //     listCommand.flags = { json: true };
  //     const data = await listCommand.run();
  //     chai.expect(data.scratchOrgs[0]).to.have.ownProperty('SignupUsername').to.equal('gaz@foo.org');
  //     chai.expect(data.scratchOrgs.length).to.equal(2);
  //     chai.expect(data.scratchOrgs.every((element) => element.status.includes('Active'))).to.be.true;
  //   });

  //   it('all set --all orgs', async () => {
  //     OrgListMock.retrieveAuthInfo(sandbox);
  //     listCommand.flags = { all: true };
  //     const data = await listCommand.run();
  //     chai.expect(data.nonScratchOrgs.length).to.equal(1);
  //     chai.expect(
  //       data.scratchOrgs.every((element) => {
  //         element.status === 'Active';
  //       })
  //     ).to.be.false;
  //   });

  //   it('clean expired', async () => {
  //     const stub = sandbox.stub().resolves({});
  //     stubMethod(sandbox, AuthInfo, 'create').callsFake(async () => ({
  //       getConnectionOptions: () => ({}),
  //     }));
  //     stubMethod(sandbox, Org, 'create').callsFake(async () => ({
  //       remove: stub,
  //     }));
  //     await listCommand.cleanScratchOrgs(OrgListMock.AUTH_INFO['expiredScratchOrgs']);

  //     chai.expect(stub.called).to.be.true;
  //   });
  // });
});
