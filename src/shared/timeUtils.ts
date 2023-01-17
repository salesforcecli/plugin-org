/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Duration } from '@salesforce/kit';

export type TimeComponents = {
  days: Duration;
  hours: Duration;
  minutes: Duration;
  seconds: Duration;
};

export const getClockForSeconds = (timeInSec: number): string => {
  const tc = getTimeComponentsFromSeconds(timeInSec);

  const dDisplay: string = tc.days.days > 0 ? `${tc.days.days.toString()}:` : '';
  const hDisplay: string = tc.hours.hours.toString().padStart(2, '0');
  const mDisplay: string = tc.minutes.minutes.toString().padStart(2, '0');
  const sDisplay: string = tc.seconds.seconds.toString().padStart(2, '0');

  return `${dDisplay}${hDisplay}:${mDisplay}:${sDisplay}`;
};
export const getTimeComponentsFromSeconds = (timeInSec: number): TimeComponents => {
  const days = Duration.days(Math.floor(timeInSec / 86_400));
  const hours = Duration.hours(Math.floor((timeInSec % 86_400) / 3_600));
  const minutes = Duration.minutes(Math.floor((timeInSec % 3_600) / 60));
  const seconds = Duration.seconds(Math.floor(timeInSec % 60));

  return { days, hours, minutes, seconds };
};
export const getSecondsToHuman = (timeInSec: number): string => {
  const tc = getTimeComponentsFromSeconds(timeInSec);

  const dDisplay: string = tc.days.days > 0 ? tc.days.toString() + ' ' : '';
  const hDisplay: string = tc.hours.hours > 0 ? tc.hours.toString() + ' ' : '';
  const mDisplay: string = tc.minutes.minutes > 0 ? tc.minutes.toString() + ' ' : '';
  const sDisplay: string = tc.seconds.seconds > 0 ? tc.seconds.toString() : '';

  return (dDisplay + hDisplay + mDisplay + sDisplay).trim();
};
