/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type SpinnerName } from 'cli-spinners';
import figures from 'figures';

export const icons = {
  pending: figures.squareSmallFilled,
  skipped: figures.circle,
  completed: figures.tick,
  failed: figures.cross,
};

export const spinners: Record<string, SpinnerName> = {
  stage: process.platform === 'win32' ? 'line' : 'dots2',
  info: process.platform === 'win32' ? 'line' : 'arc',
};
