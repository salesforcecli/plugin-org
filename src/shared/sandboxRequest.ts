/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';

import { Logger, SandboxInfo, SandboxRequest, Messages, SfError, Lifecycle, Connection } from '@salesforce/core';
import { lowerToUpper } from './utils.js';
import { SandboxLicenseType } from './orgTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const cloneMessages = Messages.loadMessages('@salesforce/plugin-org', 'clone');

export const generateSboxName = async (): Promise<string> => {
  // sandbox names are 10 chars or less, a radix of 36 = [a-z][0-9]
  // technically without querying the production org, the generated name could already exist, but the chances of that are lower than the perf penalty of querying and verifying
  const generated = `sbx${Date.now().toString(36).slice(-7)}`;
  await Lifecycle.getInstance().emitWarning(`No SandboxName defined, generating new SandboxName: ${generated}`);
  return generated;
};

// Reads the sandbox definition file and converts properties to CapCase.
export function readSandboxDefFile(
  defFile: string
): Partial<SandboxInfo & { ApexClassName?: string; ActivationUserGroupName?: string; SourceSandboxName?: string }> {
  const fileContent = fs.readFileSync(defFile, 'utf-8');
  const parsedContent = lowerToUpper(JSON.parse(fileContent) as Record<string, unknown>);

  // validate input
  if (parsedContent.ApexClassName && parsedContent.ApexClassId) {
    throw cloneMessages.createError('error.bothApexClassIdAndNameProvided');
  }

  if (parsedContent.ActivationUserGroupId && parsedContent.ActivationUserGroupName) {
    throw cloneMessages.createError('error.bothUserGroupIdAndNameProvided');
  }

  if (parsedContent.SourceId && parsedContent.SourceSandboxName) {
    throw cloneMessages.createError('error.bothSourceIdAndNameProvided');
  }

  if (parsedContent.SourceId && parsedContent.LicenseType) {
    throw cloneMessages.createError('error.bothSourceIdAndLicenseTypeProvided');
  }

  if (parsedContent.LicenseType && parsedContent.SourceSandboxName) {
    throw cloneMessages.createError('error.bothSourceSandboxNameAndLicenseTypeProvided');
  }

  return parsedContent as Partial<SandboxInfo>;
}

export async function createSandboxRequest(
  definitionFile: string | undefined,
  logger?: Logger | undefined,
  properties?: Record<string, string | undefined>
): Promise<{
  sandboxReq: SandboxRequest & {
    ApexClassName: string | undefined;
    ActivationUserGroupName: string | undefined;
  };
  srcSandboxName: string;
  srcId: string;
}>;
export async function createSandboxRequest(
  definitionFile: string | undefined,
  logger?: Logger | undefined,
  properties?: Record<string, string | undefined>
): Promise<{
  sandboxReq: SandboxRequest & {
    ApexClassName: string | undefined;
    ActivationUserGroupName: string | undefined;
  };
}>;
export async function createSandboxRequest(
  definitionFile: string | undefined,
  logger?: Logger | undefined,
  properties?: Record<string, string | undefined>
): Promise<{ sandboxReq: SandboxRequest; srcSandboxName?: string; srcId?: string }> {
  if (!logger) {
    logger = await Logger.child('createSandboxRequest');
  }
  logger.debug('Varargs: %s ', properties);

  const sandboxDefFileContents = definitionFile ? readSandboxDefFile(definitionFile) : {};

  const capitalizedVarArgs = properties ? lowerToUpper(properties) : {};
  // varargs override file input
  const sandboxReqWithName: SandboxRequest & { SourceSandboxName?: string; SourceId?: string } = {
    ...(sandboxDefFileContents as Record<string, unknown>),
    ...capitalizedVarArgs,
    SandboxName:
      (capitalizedVarArgs.SandboxName as string) ??
      (sandboxDefFileContents.SandboxName as string) ??
      (await generateSboxName()),
  };
  const isClone = sandboxReqWithName.SourceSandboxName ?? sandboxReqWithName.SourceId;
  const { SourceSandboxName, SourceId, ...sandboxReq } = sandboxReqWithName;
  logger.debug('SandboxRequest after merging DefFile and Varargs: %s ', sandboxReq);

  if (isClone) {
    if (!sandboxReqWithName.SourceSandboxName && !sandboxReqWithName.SourceId) {
      // error - we need SourceSandboxName or SourceID to know which sandbox to clone from
      throw new SfError(
        cloneMessages.getMessage('missingSourceSandboxNameORSourceId'),
        cloneMessages.getMessage('missingSourceSandboxNameORSourceIdAction')
      );
    }
    return { sandboxReq, srcSandboxName: SourceSandboxName, srcId: SourceId };
  } else {
    if (!sandboxReq.LicenseType) {
      return { sandboxReq: { ...sandboxReq, LicenseType: SandboxLicenseType.developer } };
    }
    return { sandboxReq };
  }
}
export async function getApexClassIdByName(conn: Connection, className: string): Promise<string | undefined> {
  try {
    const result = (await conn.singleRecordQuery(`SELECT Id FROM ApexClass WHERE Name = '${className}'`)).Id;
    return result;
  } catch (err) {
    throw cloneMessages.createError('error.apexClassQueryFailed', [className], [], err as Error);
  }
}
export async function getUserGroupIdByName(conn: Connection, groupName: string): Promise<string | undefined> {
  try {
    const result = (await conn.singleRecordQuery(`SELECT id FROM Group WHERE NAME = '${groupName}'`)).Id;
    return result;
  } catch (err) {
    throw cloneMessages.createError('error.userGroupQueryFailed', [groupName], [], err as Error);
  }
}
export async function getSrcIdByName(conn: Connection, sandboxName: string): Promise<string | undefined> {
  try {
    const result = (
      await conn.singleRecordQuery(`SELECT id FROM SandboxInfo WHERE SandboxName = '${sandboxName}'`, { tooling: true })
    ).Id;
    return result;
  } catch (err) {
    throw cloneMessages.createError('error.sandboxNameQueryFailed', [sandboxName], [], err as Error);
  }
}

export default {
  createSandboxRequest,
  generateSboxName,
  readSandboxDefFile,
  getApexClassIdByName,
  getUserGroupIdByName,
  getSrcIdByName,
};
