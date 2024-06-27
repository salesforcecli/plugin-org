/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteStream } from 'node:tty';
import React from 'react';
import { render as inkRender, Instance } from 'ink';
import { SfError } from '@salesforce/core';

const ERROR_KEY = Symbol('error');

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
const Context = React.createContext((_state: any) => {});

type BaseState<T = Record<string | symbol, unknown>> = T & {
  readonly [ERROR_KEY]?: SfError | Error;
};

export abstract class BaseComponent<
  Props = Record<string, unknown>,
  State = Readonly<BaseState>
> extends React.Component<Props, State> {
  public static contextType = Context;

  // eslint-disable-next-line react/static-property-placement
  public declare context: React.ContextType<typeof Context>;

  private error: SfError | Error | undefined;

  public componentWillUnmount(): void {
    this.context(this.state);
  }

  public setError(error: SfError | Error | undefined): void {
    this.error = error;
    this.context({ ...this.state, [ERROR_KEY]: error });
  }

  public getError(): SfError | Error | undefined {
    return this.error;
  }
}

function getStream(channel: 'stdout' | 'stderr', jsonEnabled: boolean): WriteStream {
  if (jsonEnabled) {
    // If JSON is enabled, we need to return a stream that does nothing
    const stream = new WriteStream(0);
    stream.write = (): boolean => true;
    return stream;
  }

  return process[channel];
}

export async function render<T extends Record<string | symbol, unknown>>(
  component: React.ReactElement,
  jsonEnabled = false
): Promise<{ instance: Instance; finalState: T }> {
  let finalState = {} as T;
  const cb = (state: T): void => {
    finalState = { ...finalState, ...state };
  };

  const instance = inkRender(<Context.Provider value={cb}>{component}</Context.Provider>, {
    stdout: getStream('stdout', jsonEnabled),
    stderr: getStream('stderr', jsonEnabled),
  });
  await instance.waitUntilExit();

  if (finalState[ERROR_KEY]) {
    throw finalState[ERROR_KEY];
  }

  return { instance, finalState };
}
