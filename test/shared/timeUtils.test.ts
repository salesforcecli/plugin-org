/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { Duration } from '@salesforce/cli-plugins-testkit';
import { getClockForSeconds, getSecondsToHuman } from '../../src/utils/timeUtils';

describe('timeUtils', () => {
  describe('getSecondsToHuman', () => {
    it('should build time string with 10 seconds', () => {
      expect(getSecondsToHuman(10)).to.includes('10 seconds');
    });
    it('should build time string 1 minute', () => {
      expect(getSecondsToHuman(60)).to.includes('1 minute');
    });
    it('should build time string 1 hour', () => {
      expect(getSecondsToHuman(Duration.hours(1).seconds)).to.includes('1 hour');
    });
    it('should build time string 1 day', () => {
      expect(getSecondsToHuman(Duration.days(1).seconds)).to.includes('1 day');
    });
    it('should build time string 1 day 12 hours', () => {
      expect(getSecondsToHuman(Duration.days(1).seconds + Duration.hours(12).seconds)).to.includes('1 day 12 hour');
    });
  });
  describe('getClockForSeconds', () => {
    it('should build time string with 10 seconds', () => {
      expect(getClockForSeconds(10)).to.be.equal('00:00:10');
    });
    it('should build time string 1 minute', () => {
      expect(getClockForSeconds(60)).to.be.equal('00:01:00');
    });
    it('should build time string 1 hour', () => {
      expect(getClockForSeconds(Duration.hours(1).seconds)).to.be.equal('01:00:00');
    });
    it('should build time string 1 day', () => {
      expect(getClockForSeconds(Duration.days(1).seconds)).to.be.equal('1:00:00:00');
    });
    it('should build time string 1 day 12 hours', () => {
      expect(getClockForSeconds(Duration.days(1).seconds + Duration.hours(12).seconds)).to.be.equal('1:12:00:00');
    });
  });
});
