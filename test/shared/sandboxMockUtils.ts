/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';
import { SaveResult } from 'jsforce';
import sinon from 'sinon';
import { AuthFields, AuthInfo, Connection, Global, Org, SandboxInfo, SandboxProcessObject } from '@salesforce/core';
import { CachedOptions } from '@salesforce/core/lib/org/scratchOrgCache.js';

const sbxName = 'testSbx1';
const sandboxProcessObject: SandboxProcessObject = {
  Id: '0GR1Q0000004kmaWAA',
  Status: 'Pending',
  SandboxName: sbxName,
  SandboxInfoId: '0GQ1Q0000004iQDWAY',
  LicenseType: 'DEVELOPER',
  CreatedDate: '2024-02-21T23:06:58.000+0000',
  CopyProgress: 0,
  SandboxOrganization: '00DDX000000QT3W',
  Description: 'testing sandbox create and refresh',
};

const sandboxInfo: SandboxInfo = {
  Id: '0GQ1Q0000004iQDWAY',
  SandboxName: sbxName,
  LicenseType: 'DEVELOPER',
  HistoryDays: 0,
  CopyChatter: false,
  AutoActivate: true,
  IsDeleted: false,
  CreatedDate: '2024-02-16T17:06:47.000+0000',
  CreatedById: '005B0000004TiUpIAK',
  LastModifiedDate: '2024-02-16T17:06:47.000+0000',
  LastModifiedById: '005B0000004TiUpIAK',
};

const sandboxInfoUneditableFields = ['IsDeleted', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById'];

const sandboxInfoFields = [
  'Id',
  'SandboxName',
  'LicenseType',
  'TemplateId',
  'HistoryDays',
  'CopyChatter',
  'AutoActivate',
  'ApexClassId',
  'Description',
  'SourceId',
  ...sandboxInfoUneditableFields,
];

const sandboxProcessFields = [
  'Id',
  'Status',
  'SandboxName',
  'SandboxInfoId',
  'LicenseType',
  'CreatedDate',
  'CopyProgress',
  'SandboxOrganization',
  'SourceId',
  'Description',
  'EndDate',
];

export const updateSuccessResponse: SaveResult = {
  success: true,
  id: sandboxProcessObject.SandboxInfoId,
  errors: [],
};

export const readSandboxCacheFile = (cacheFilePath: string): Record<string, CachedOptions> =>
  JSON.parse(fs.readFileSync(cacheFilePath, 'utf8')) as unknown as Record<string, CachedOptions>;
export const deleteSandboxCacheFile = (cacheFilePath: string): void => fs.unlinkSync(cacheFilePath);
export const readAuthFile = (homeDir: string, username: string): AuthFields => {
  const filePath = path.join(homeDir, Global.STATE_FOLDER, `${username}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as AuthFields;
};
export const getSandboxInfo = (overrides?: Partial<SandboxInfo>): SandboxInfo =>
  Object.assign({}, sandboxInfo, overrides);
export const getSandboxProcess = (overrides?: Partial<SandboxProcessObject>): SandboxProcessObject =>
  Object.assign({}, sandboxProcessObject, overrides);
export const getSandboxInfoSoql = (sandboxName = sbxName) =>
  `SELECT ${sandboxInfoFields.join(',')} FROM SandboxInfo WHERE SandboxName='${sandboxName}'`;
export const getSandboxProcessSoql = (cfg?: SbxProcessSqlConfig) => {
  const whereClause = cfg?.sandboxName
    ? `SandboxName='${cfg.sandboxName}'`
    : cfg?.sandboxInfoId
    ? `SandboxInfoId='${cfg.sandboxInfoId}'`
    : `SandboxName='${sbxName}'`;

  return `SELECT ${sandboxProcessFields.join(',')} FROM SandboxProcess WHERE ${whereClause} ORDER BY CreatedDate DESC`;
};

/**
 * Decorates the `Org.create()` call for the given username to use a stubbed connection so that
 * calls to update and queries are not actually made to the org.
 *
 * @param sinonSandbox
 * @param username
 * @returns Connection used for the stub
 */
export const stubProdOrgConnection = async (
  sinonSandbox: sinon.SinonSandbox,
  username: string
): Promise<Connection> => {
  const connection = await Connection.create({
    authInfo: await AuthInfo.create({ username }),
  });

  // save original Org.create function to call in the fake
  const orgCreateFn = Org.create.bind(Org);
  sinonSandbox
    .stub(Org, 'create')
    .withArgs({ aliasOrUsername: username })
    .callsFake(async (opts) => {
      const org = (await orgCreateFn(opts)) as Org;
      // @ts-expect-error re-assigning a private property
      org.connection = connection;
      return org;
    });

  return connection;
};

type SingleRecordQueryStubConfig = {
  sinonSandbox: sinon.SinonSandbox;
  connection: Connection;
  sandboxInfoSoql: string;
  sbxInfo: SandboxInfo;
};
/**
 * Stubs the query for an existing SandboxInfo
 *
 * @param config
 * @returns sinon.SinonStub
 */
export const stubSingleRecordQuery = (config: SingleRecordQueryStubConfig): sinon.SinonStub => {
  const { sinonSandbox, connection, sandboxInfoSoql, sbxInfo } = config;
  return sinonSandbox
    .stub(connection, 'singleRecordQuery')
    .withArgs(sandboxInfoSoql, { tooling: true })
    .resolves(sbxInfo);
};

type ToolingUpdateStubConfig = {
  sinonSandbox: sinon.SinonSandbox;
  connection: Connection;
  response?: SaveResult;
};
/**
 * Stubs the call to update the SandboxInfo
 *
 * @param config
 * @returns sinon.SinonStub
 */
export const stubToolingUpdate = (config: ToolingUpdateStubConfig): sinon.SinonStub => {
  const { sinonSandbox, connection, response = updateSuccessResponse } = config;
  return sinonSandbox.stub(connection.tooling, 'update').resolves(response);
};

/**
 * Stubs the call to create the SandboxInfo
 *
 * @param config
 * @returns sinon.SinonStub
 */
export const stubToolingCreate = (config: ToolingUpdateStubConfig): sinon.SinonStub => {
  const { sinonSandbox, connection, response = updateSuccessResponse } = config;
  return sinonSandbox.stub(connection.tooling, 'create').resolves(response);
};

type ToolingQueryStubConfig = {
  sinonSandbox: sinon.SinonSandbox;
  connection: Connection;
  sandboxProcessSoql: string;
  sbxProcess: SandboxProcessObject;
};

type SbxProcessSqlConfig = {
  sandboxName?: string;
  sandboxInfoId?: string;
};
/**
 * Stubs the query for the newly created SandboxProcess from a sandbox update.
 * Stubs the query for a cloned sandbox process (see `CreateSandbox.getSourceId()`).
 *
 * @param config
 * @returns sinon.SinonStub
 */
export const stubToolingQuery = (config: ToolingQueryStubConfig): sinon.SinonStub => {
  const { sinonSandbox, connection, sandboxProcessSoql, sbxProcess } = config;
  return sinonSandbox
    .stub(connection.tooling, 'query')
    .withArgs(sandboxProcessSoql)
    .resolves({ records: [sbxProcess], done: true, totalSize: 1 });
};
