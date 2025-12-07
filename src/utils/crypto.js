const crypto = require('crypto');
const { promisify } = require('util');
const config = require('../config');

const scrypt = promisify(crypto.scrypt);

/**
 * Cryptography utilities for private key encryption/decryption
 *
 * Security model:
 * 1. User's FHE private key is encrypted with AES-256-GCM
 * 2. Encryption key derived from user's password using scrypt (memory-hard KDF)
 * 3. Unique salt per user prevents rainbow table attacks
 * 4. Authentication tag (GCM) ensures integrity
 * 5. IV randomized per encryption
 *
 * Frontend integration:
 * - User must provide password to decrypt private key
 * - Decryption happens server-side in memory
 * - Private key returned to client for session use
 * - Server never persists plaintext private key
 */

/**
 * Derive encryption key from password using scrypt
 *
 * @param {string} password - User's password
 * @param {Buffer} salt - Unique salt (32 bytes)
 * @returns {Promise<Buffer>} Derived key
 */
async function deriveKey(password, salt) {
  const key = await scrypt(
    password,
    salt,
    config.scrypt.keylen,
    {
      N: config.scrypt.N,
      r: config.scrypt.r,
      p: config.scrypt.p
    }
  );
  return key;
}

/**
 * Encrypt private key with password-derived key
 *
 * @param {string} privateKey - Plaintext private key (hex string)
 * @param {string} password - User's password
 * @returns {Promise<Object>} { iv, salt, data, authTag } all as hex strings
 */
async function encryptPrivateKey(privateKey, password) {
  // Generate random salt and IV
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  // Derive encryption key from password
  const key = await deriveKey(password, salt);

  // Encrypt using AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Zero out sensitive buffers
  key.fill(0);

  return {
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    data: encrypted,
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt private key using password
 *
 * @param {Object} encryptedData - { iv, salt, data, authTag } as hex strings
 * @param {string} password - User's password
 * @returns {Promise<string>} Decrypted private key
 * @throws {Error} If authentication fails or password incorrect
 */
async function decryptPrivateKey(encryptedData, password) {
  const { iv, salt, data, authTag } = encryptedData;

  // Convert hex strings to buffers
  const ivBuffer = Buffer.from(iv, 'hex');
  const saltBuffer = Buffer.from(salt, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');

  // Derive decryption key
  const key = await deriveKey(password, saltBuffer);

  // Decrypt using AES-256-GCM
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  let decrypted;
  try {
    decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
  } catch (error) {
    // Zero out key before throwing
    key.fill(0);
    throw new Error('Decryption failed: incorrect password or corrupted data');
  }

  // Zero out sensitive buffers
  key.fill(0);

  return decrypted;
}

/**
 * Generate secure random string
 *
 * @param {number} length - Length in bytes
 * @returns {string} Hex-encoded random string
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash data for audit logging (one-way)
 *
 * @param {string} data - Data to hash
 * @returns {string} SHA-256 hash (hex)
 */
function hashData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
  encryptPrivateKey,
  decryptPrivateKey,
  generateRandomString,
  hashData
};
