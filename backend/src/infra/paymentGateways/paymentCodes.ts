import crypto from 'node:crypto';

export function hex(n: number): string {
  return crypto.randomBytes(n).toString('hex').toUpperCase();
}

export function reference(orderId: string): string {
  return `DH-${orderId.replace(/-/g, '')}-${hex(4)}`;
}

export function voucher(): string {
  return `OD-${hex(4)}`;
}
