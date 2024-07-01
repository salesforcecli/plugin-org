/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';
import React from 'react';
import { Text } from 'ink';
import { BaseComponent, renderOnce } from '../../components/baseComponent.js';

export type FooBarResult = {
  path: string;
};

export class MyComponent extends BaseComponent<{ name: string | undefined }> {
  public state = {
    name: this.props.name,
  };
  // eslint-disable-next-line class-methods-use-this
  public async componentDidMount(): Promise<void> {
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
    if (process.env.FORCE_ERROR) {
      await sleep(250);
      this.setError(new SfError('forced error'));
    }

    await this.done();
  }

  public render(): React.ReactNode {
    return (
      <Text>hello {this.props.name} from /Users/mdonnalley/repos/salesforcecli/plugin-org/src/commands/foo/bar.ts</Text>
    );
  }
}

function Message({ name }: { readonly name: string }): React.ReactElement {
  return <Text>hello {name}</Text>;
}

export default class FooBar extends SfCommand<FooBarResult> {
  public static readonly summary = 'summary';
  public static readonly description = 'descriptions';

  public static readonly flags = {
    name: Flags.string(),
    ink: Flags.boolean(),
  };

  public async run(): Promise<FooBarResult> {
    const { flags } = await this.parse(FooBar);
    if (flags.ink) {
      renderOnce(<MyComponent name={flags.name ?? 'world'} />);
      renderOnce(<Message name="Libby" />);
      this.log('done rendering');
      // await render(<MyComponent name={flags.name ?? 'world'} />, this.jsonEnabled());
    }

    return {
      path: '/Users/mdonnalley/repos/salesforcecli/plugin-org/src/commands/foo/bar.ts',
    };
  }
}
