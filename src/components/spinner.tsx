/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, { useEffect, useState } from 'react';
import spinners, { type SpinnerName } from 'cli-spinners';
import { Box, Text } from 'ink';

export type UseSpinnerProps = {
  /**
   * Type of a spinner.
   * See [cli-spinners](https://github.com/sindresorhus/cli-spinners) for available spinners.
   *
   * @default dots
   */
  type?: SpinnerName;
};

export type UseSpinnerResult = {
  frame: string;
};

export function useSpinner({ type = 'dots' }: UseSpinnerProps): UseSpinnerResult {
  const [frame, setFrame] = useState(0);
  const spinner = spinners[type];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((previousFrame) => {
        const isLastFrame = previousFrame === spinner.frames.length - 1;
        return isLastFrame ? 0 : previousFrame + 1;
      });
    }, spinner.interval);

    return (): void => {
      clearInterval(timer);
    };
  }, [spinner]);

  return {
    frame: spinner.frames[frame] ?? '',
  };
}

export type SpinnerProps = UseSpinnerProps & {
  /**
   * Label to show near the spinner.
   */
  readonly label?: string;
  readonly bold?: boolean;
};

export function Spinner({ bold, label, type }: SpinnerProps): JSX.Element {
  const { frame } = useSpinner({ type });

  return (
    <Box>
      {bold ? (
        <Text color="magenta" bold>
          {frame}
        </Text>
      ) : (
        <Text color="magenta">{frame}</Text>
      )}

      {label && <Text>{label}</Text>}
    </Box>
  );
}
