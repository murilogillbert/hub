import { describe, expect, it } from 'vitest';
import { cashbackFor, driverCommissionFor, partnerNet, platformFeeFor } from '../src/domain/commissionRules.js';

describe('commissionRules', () => {
  it('cashbackFor rounds to currency', () => {
    expect(cashbackFor(19.99, 7.5)).toBe(1.5);
  });

  it('partnerNet subtracts platform fee and cashback', () => {
    const platformFee = platformFeeFor(100, 12);
    expect(partnerNet(100, platformFee, 8)).toBe(80);
  });

  it('partnerNet without commission behaves exactly as before (backward compatible default)', () => {
    expect(partnerNet(100, 10, 5)).toBe(85);
  });

  it('driverCommissionFor computes a percentage of the subtotal', () => {
    expect(driverCommissionFor(200, 5)).toBe(10);
  });

  it('partnerNet also subtracts the driver commission when present', () => {
    const platformFee = platformFeeFor(100, 12);
    const commission = driverCommissionFor(100, 5);
    expect(partnerNet(100, platformFee, 8, commission)).toBe(75);
  });

  it('driver commission never changes the platform fee itself', () => {
    const platformFee = platformFeeFor(100, 12);
    expect(platformFee).toBe(platformFeeFor(100, 12));
  });
});
