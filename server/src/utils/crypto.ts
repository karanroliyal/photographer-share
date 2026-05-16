import CryptoJS from 'crypto-js';
import { env } from '../config/env';

const KEY = CryptoJS.enc.Hex.parse(env.AES_MASTER_KEY);

/**
 * Encrypt a plaintext string using AES-256-CBC.
 * Used to store integration secrets (R2 keys, Stripe keys) in the DB.
 */
export function encrypt(plaintext: string): string {
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, KEY, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // Prefix with IV so we can decrypt later
  return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
}

/**
 * Decrypt an AES-256-CBC encrypted string.
 */
export function decrypt(ciphertext: string): string {
  const [ivHex, encryptedData] = ciphertext.split(':');
  if (!ivHex || !encryptedData) throw new Error('Invalid encrypted format');

  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const decrypted = CryptoJS.AES.decrypt(encryptedData, KEY, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}
