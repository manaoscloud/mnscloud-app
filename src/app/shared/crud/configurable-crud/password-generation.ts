/** Cryptographic generation with rejection sampling, without modulo bias or weak fallbacks. */
export function generateCrudPassword(length: number): string {
  if (!Number.isInteger(length) || length < 1 || length > 128) {
    throw new RangeError('Invalid generated password length.');
  }
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const ceiling = 256 - (256 % alphabet.length);
  const bytes = new Uint8Array(64);
  let password = '';
  while (password.length < length) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < ceiling) password += alphabet[byte % alphabet.length];
      if (password.length === length) break;
    }
  }
  return password;
}
