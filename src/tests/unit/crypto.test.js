const { expect } = require('chai');
const { encryptPrivateKey, decryptPrivateKey, hashData } = require('../../utils/crypto');

describe('Crypto Utils', () => {
  const password = 'SecurePassword123!';
  const privateKey = '0xPRIV_test1234567890abcdef';

  describe('encryptPrivateKey and decryptPrivateKey', () => {
    it('should encrypt and decrypt private key successfully', async () => {
      // Encrypt
      const encrypted = await encryptPrivateKey(privateKey, password);

      expect(encrypted).to.have.property('iv');
      expect(encrypted).to.have.property('salt');
      expect(encrypted).to.have.property('data');
      expect(encrypted).to.have.property('authTag');

      // Decrypt
      const decrypted = await decryptPrivateKey(encrypted, password);
      expect(decrypted).to.equal(privateKey);
    });

    it('should fail to decrypt with wrong password', async () => {
      const encrypted = await encryptPrivateKey(privateKey, password);

      try {
        await decryptPrivateKey(encrypted, 'WrongPassword');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Decryption failed');
      }
    });

    it('should produce different ciphertext for same input', async () => {
      const encrypted1 = await encryptPrivateKey(privateKey, password);
      const encrypted2 = await encryptPrivateKey(privateKey, password);

      // Different IV and salt should produce different ciphertext
      expect(encrypted1.iv).to.not.equal(encrypted2.iv);
      expect(encrypted1.salt).to.not.equal(encrypted2.salt);
      expect(encrypted1.data).to.not.equal(encrypted2.data);
    });
  });

  describe('hashData', () => {
    it('should produce consistent hash for same input', () => {
      const data = 'test data';
      const hash1 = hashData(data);
      const hash2 = hashData(data);

      expect(hash1).to.equal(hash2);
      expect(hash1).to.be.a('string');
      expect(hash1).to.have.lengthOf(64); // SHA-256 hex
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashData('data1');
      const hash2 = hashData('data2');

      expect(hash1).to.not.equal(hash2);
    });
  });
});
