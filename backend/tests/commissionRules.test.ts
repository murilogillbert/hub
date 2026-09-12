import { describe, expect, it } from 'vitest';
import { cashbackFor, partnerNet, platformFeeFor } from '../src/domain/commissionRules.js';

describe('commissionRules', () => {
  it('cashbackFor rounds to currency', () => {
    expect(cashbackFor(19.99, 7.5)).toBe(1.5);
  });

  it('partnerNet subtracts platform fee and cashback', () => {
    const platformFee = platformFeeFor(100, 12);
    expect(partnerNet(100, platformFee, 8)).toBe(80);
  });
});
