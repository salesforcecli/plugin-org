/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';

import { Logger, SandboxInfo, SandboxRequest, Messages, SfError, Lifecycle } from '@salesforce/core';
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
export function readSandboxDefFile(defFile: string): Partial<SandboxInfo> {
  const fileContent = fs.readFileSync(defFile, 'utf-8');
  const parsedContent = JSON.parse(fileContent) as Record<string, unknown>;
  return lowerToUpper(parsedContent) as Partial<SandboxInfo>;
}

export async function createSandboxRequest(
  isClone: true,
  definitionFile: string | undefined,
  logger?: Logger | undefined,
  properties?: Record<string, string | undefined>
): Promise<{
  sandboxReq: SandboxRequest & {
    ApexClassName: string | undefined;
    ApexClassId: string | undefined;
    ActivationUserGroupName: string | undefined;
    ActivationUserGroupId: string | undefined;
  };
  srcSandboxName: string;
}>;
export async function createSandboxRequest(
  isClone: false,
  definitionFile: string | undefined,
  logger?: Logger | undefined,
  properties?: Record<string, string | undefined>
): Promise<{
  sandboxReq: SandboxRequest & {
    ApexClassName: string | undefined;
    ApexClassId: string | undefined;
    ActivationUserGroupName: string | undefined;
    ActivationUserGroupId: string | undefined;
  };
}>;
export async function createSandboxRequest(
  isClone = false,
  definitionFile: string | undefined,
  logger?: Logger | undefined,
  properties?: Record<string, string | undefined>
): Promise<{ sandboxReq: SandboxRequest; srcSandboxName?: string }> {
  if (!logger) {
    logger = await Logger.child('createSandboxRequest');
  }
  logger.debug('Varargs: %s ', properties);

  const sandboxDefFileContents = definitionFile ? readSandboxDefFile(definitionFile) : {};

  const capitalizedVarArgs = properties ? lowerToUpper(properties) : {};

  // varargs override file input
  const sandboxReqWithName: SandboxRequest & { SourceSandboxName?: string } = {
    ...(sandboxDefFileContents as Record<string, unknown>),
    ...capitalizedVarArgs,
    SandboxName:
      (capitalizedVarArgs.SandboxName as string) ??
      (sandboxDefFileContents.SandboxName as string) ??
      (await generateSboxName()),
  };

  const { SourceSandboxName, ...sandboxReq } = sandboxReqWithName;
  logger.debug('SandboxRequest after merging DefFile and Varargs: %s ', sandboxReq);

  if (isClone) {
    if (!SourceSandboxName) {
      // error - we need SourceSandboxName to know which sandbox to clone from
      throw new SfError(
        cloneMessages.getMessage('missingSourceSandboxName', ['SourceSandboxName']),
        cloneMessages.getMessage('missingSourceSandboxNameAction', ['SourceSandboxName'])
      );
    }
    return { sandboxReq, srcSandboxName: SourceSandboxName };
  } else {
    if (!sandboxReq.LicenseType) {
      return { sandboxReq: { ...sandboxReq, LicenseType: SandboxLicenseType.developer } };
    }
    return { sandboxReq };
  }
}

export default {
  createSandboxRequest,
  generateSboxName,
  readSandboxDefFile,
};
