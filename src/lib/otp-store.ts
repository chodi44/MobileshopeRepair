/**
 * Server-side in-memory OTP store.
 * OTPs expire in 5 minutes. Only one active OTP at a time.
 */

interface OtpEntry {
  otp: string;
  expiresAt: number; // Date.now() + 5min
}

// Module-level store (server-side only)
let currentOtp: OtpEntry | null = null;

export function generateAndStoreOtp(): string {
  const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  currentOtp = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
  return otp;
}

export function verifyOtp(input: string): boolean {
  if (!currentOtp) return false;
  if (Date.now() > currentOtp.expiresAt) {
    currentOtp = null;
    return false;
  }
  const valid = currentOtp.otp === input.trim();
  if (valid) currentOtp = null; // consume OTP
  return valid;
}
