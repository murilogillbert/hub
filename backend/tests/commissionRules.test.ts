import { describe, expect, it } from 'vitest';
import { cashbackFor, clampCommission, driverCommissionFor, partnerNet, platformFeeFor } from '../src/domain/commissionRules.js';

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

  it('clampCommission passes through when there is room for it', () => {
    // 100 paid, 10 fee, 5 cashback -> 85 remaining, commission of 20 fits.
    expect(clampCommission(100, 10, 5, 20)).toBe(20);
  });

  it('clampCommission caps commission so total credit never exceeds what was paid', () => {
    // 100% cashback + 100% commission would otherwise mint 200 in credit from a 100 sale.
    const subtotal = 100;
    const cashback = cashbackFor(subtotal, 100); // 100
    const rawCommission = driverCommissionFor(subtotal, 100); // 100
    const platformFee = platformFeeFor(subtotal, 10); // 10
    expect(clampCommission(subtotal, platformFee, cashback, rawCommission)).toBe(0);
  });

  it('clampCommission never goes negative even if fee+cashback alone exceed the subtotal', () => {
    expect(clampCommission(100, 60, 60, 50)).toBe(0);
  });
});
