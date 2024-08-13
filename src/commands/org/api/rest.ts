/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';
import { createWriteStream } from 'node:fs';
import got, { Headers } from 'got';
import type { AnyJson } from '@salesforce/ts-types';
import { ProxyAgent } from 'proxy-agent';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, Org, SfError } from '@salesforce/core';
import { Args } from '@oclif/core';
import ansis from 'ansis';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-org', 'rest');

export class Rest extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly hidden = true;
  public static enableJsonFlag = false;
  public static readonly flags = {
    // TODO: getting a false positive from this eslint rule.
    // summary is already set in the org flag.
    // eslint-disable-next-line sf-plugin/flag-summary
    'target-org': Flags.requiredOrg({
      helpValue: 'username',
    }),
    include: Flags.boolean({
      char: 'i',
      summary: messages.getMessage('flags.include.summary'),
      default: false,
      exclusive: ['stream-to-file'],
    }),
    method: Flags.option({
      options: ['GET', 'POST', 'PUT', 'PATCH', 'HEAD', 'DELETE', 'OPTIONS', 'TRACE'] as const,
      summary: messages.getMessage('flags.method.summary'),
      char: 'X',
      default: 'GET',
    })(),
    header: Flags.string({
      summary: messages.getMessage('flags.header.summary'),
      helpValue: 'key:value',
      char: 'H',
      multiple: true,
    }),
    'stream-to-file': Flags.string({
      summary: messages.getMessage('flags.stream-to-file.summary'),
      helpValue: 'Example: report.xlsx',
      char: 'S',
      exclusive: ['include'],
    }),
    body: Flags.string({
      summary: messages.getMessage('flags.body.summary'),
      allowStdin: true,
      helpValue: 'file',
    }),
  };

  public static args = {
    endpoint: Args.string({
      description: 'Salesforce API endpoint',
      required: true,
    }),
  };

  private static getHeaders(keyValPair: string[]): Headers {
    const headers: { [key: string]: string } = {};

    for (const header of keyValPair) {
      const [key, ...rest] = header.split(':');
      const value = rest.join(':').trim();
      if (!key || !value) {
        throw new SfError(`Failed to parse HTTP header: "${header}".`, 'Failed To Parse HTTP Header', [
          'Make sure the header is in a "key:value" format, e.g. "Accept: application/json"',
        ]);
      }
      headers[key] = value;
    }

    return headers;
  }

  public async run(): Promise<void> {
    const { flags, args } = await this.parse(Rest);

    const org = flags['target-org'];
    const streamFile = flags['stream-to-file'];

    await org.refreshAuth();

    const url = `${org.getField<string>(Org.Fields.INSTANCE_URL)}/${args.endpoint}`;

    const options = {
      agent: { https: new ProxyAgent() },
      method: flags.method,
      headers: {
        Authorization: `Bearer ${
          // we don't care about apiVersion here, just need to get the access token.
          // eslint-disable-next-line sf-plugin/get-connection-with-version
          org.getConnection().getConnectionOptions().accessToken!
        }`,
        ...(flags.header ? Rest.getHeaders(flags.header) : {}),
      },
      body: flags.method === 'GET' ? undefined : flags.body,
      throwHttpErrors: false,
      followRedirect: false,
    };

    if (streamFile) {
      const responseStream = got.stream(url, options);
      const fileStream = createWriteStream(streamFile);
      responseStream.pipe(fileStream);

      fileStream.on('finish', () => this.log(`File saved to ${streamFile}`));
      fileStream.on('error', (error) => {
        throw SfError.wrap(error);
      });
      responseStream.on('error', (error) => {
        throw SfError.wrap(error);
      });
    } else {
      const res = await got(url, options);

      // Print HTTP response status and headers.
      if (flags.include) {
        let httpInfo = `HTTP/${res.httpVersion} ${res.statusCode} ${EOL}`;

        for (const [header] of Object.entries(res.headers)) {
          httpInfo += `${ansis.blue.bold(header)}: ${res.headers[header] as string}${EOL}`;
        }
        this.log(httpInfo);
      }

      try {
        // Try to pretty-print JSON response.
        this.styledJSON(JSON.parse(res.body) as AnyJson);
      } catch (err) {
        // If response body isn't JSON, just print it to stdout.
        this.log(res.body);
      }

      if (res.statusCode >= 400) {
        process.exitCode = 1;
      }
    }
  }
}
