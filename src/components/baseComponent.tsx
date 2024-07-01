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

const Context = React.createContext({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  state: (_state: any): void => {},
  unmount: (): void => {},
});

type BaseState<T = Record<string | symbol, unknown>> = T & {
  readonly [ERROR_KEY]?: SfError | Error;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export abstract class BaseComponent<
  Props = Record<string, unknown>,
  State = Readonly<BaseState>
> extends React.Component<Props, State> {
  public static contextType = Context;

  // eslint-disable-next-line react/static-property-placement
  public declare context: React.ContextType<typeof Context>;

  private error: SfError | Error | undefined;

  public componentWillUnmount(): void {
    this.context.state(this.state);
  }

  public setError(error: SfError | Error | undefined): void {
    this.error = error;
    this.context.state({ ...this.state, [ERROR_KEY]: error });
  }

  public getError(): SfError | Error | undefined {
    return this.error;
  }

  public async done(): Promise<void> {
    await sleep(1);
    this.context.state(this.state);
    this.context.unmount();
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
  return new Promise((resolve, reject) => {
    let finalState = {} as T;
    const callbacks = {
      state: (state: T): void => {
        finalState = { ...finalState, ...state };
      },
      unmount: (): void => {
        instance.unmount();
        if (finalState[ERROR_KEY]) {
          reject(finalState[ERROR_KEY]);
        } else {
          resolve({ instance, finalState });
        }
      },
    };

    const instance = inkRender(<Context.Provider value={callbacks}>{component}</Context.Provider>, {
      stdout: getStream('stdout', jsonEnabled),
      stderr: getStream('stderr', jsonEnabled),
    });
  });
}

export function renderOnce(component: React.ReactElement): Instance | undefined {
  const instance = inkRender(component);
  instance.unmount();
  return instance;
}
