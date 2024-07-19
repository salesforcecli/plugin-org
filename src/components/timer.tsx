/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Text } from 'ink';
import React from 'react';
import { msInMostReadableFormat, secondsInMostReadableFormat } from './utils.js';

export function Timer({
  color,
  isStopped,
  unit,
}: {
  readonly color?: string;
  readonly isStopped?: boolean;
  readonly unit: 'ms' | 's';
}): React.ReactNode {
  const [time, setTime] = React.useState(0);
  const [previousDate, setPreviousDate] = React.useState(Date.now());

  React.useEffect(() => {
    if (isStopped) {
      setTime(time + (Date.now() - previousDate));
      setPreviousDate(Date.now());
      return () => {};
    }

    const intervalId = setInterval(
      () => {
        setTime(time + (Date.now() - previousDate));
        setPreviousDate(Date.now());
      },
      unit === 'ms' ? 1 : 1000
    );

    return (): void => {
      clearInterval(intervalId);
    };
  }, [time, isStopped, previousDate, unit]);

  return (
    <Text color={color}>{unit === 'ms' ? msInMostReadableFormat(time) : secondsInMostReadableFormat(time, 0)}</Text>
  );
}
