const crypto = require('crypto');

/**
 * FHE SHIM - Mock FHE operations for local testing and development
 *
 * This module provides drop-in replacements for Zama Relayer SDK operations
 * when RELAYER_MOCK=true. It simulates encryption/decryption and homomorphic
 * operations using simple crypto primitives.
 *
 * WARNING: This is NOT secure FHE. Use only for testing!
 *
 * Purpose:
 * - Allow local development without Zama relayer access
 * - Enable unit/integration tests without network calls
 * - Verify application logic independently of FHE implementation
 *
 * Usage:
 * Set RELAYER_MOCK=true in .env, and this shim will be used instead
 * of the real Relayer SDK in relayerService.js
 */

class FHEShim {
  constructor() {
    this.keypairs = new Map(); // Store generated keypairs
    this.ciphertexts = new Map(); // Store encrypted values
    this.nextHandle = 1;
  }

  /**
   * Simulate FhevmInstance initialization
   */
  async createInstance() {
    return {
      createEncryptedInput: (contractAddress, userAddress) => {
        return this.createEncryptedInput(contractAddress, userAddress);
      },
      publicDecrypt: (handles) => this.publicDecrypt(handles),
      userDecrypt: (...args) => this.userDecrypt(...args),
      generateKeypair: () => this.generateKeypair(),
      createEIP712: (...args) => this.createEIP712(...args)
    };
  }

  /**
   * Generate a mock FHE keypair
   */
  generateKeypair() {
    const keyId = crypto.randomBytes(16).toString('hex');
    const publicKey = `0xPUB_${keyId}`;
    const privateKey = `0xPRIV_${keyId}`;

    this.keypairs.set(publicKey, privateKey);

    return { publicKey, privateKey };
  }

  /**
   * Create encrypted input buffer (mock)
   */
  createEncryptedInput(contractAddress, userAddress) {
    const buffer = {
      values: [],
      contractAddress,
      userAddress,

      add64: function(value) {
        this.values.push({ type: 'uint64', value: BigInt(value) });
        return this;
      },

      add32: function(value) {
        this.values.push({ type: 'uint32', value: BigInt(value) });
        return this;
      },

      add16: function(value) {
        this.values.push({ type: 'uint16', value: BigInt(value) });
        return this;
      },

      add8: function(value) {
        this.values.push({ type: 'uint8', value: BigInt(value) });
        return this;
      },

      addBool: function(value) {
        this.values.push({ type: 'bool', value: Boolean(value) });
        return this;
      },

      addAddress: function(value) {
        this.values.push({ type: 'address', value: String(value) });
        return this;
      },

      encrypt: async () => {
        const handles = [];
        const inputProof = crypto.randomBytes(32).toString('hex');

        // "Encrypt" each value and store
        for (const item of buffer.values) {
          const handle = this._generateHandle();
          this._storeCiphertext(handle, item.value);
          handles.push(handle);
        }

        return {
          handles,
          inputProof: `0x${inputProof}`
        };
      }.bind(this)
    };

    return buffer;
  }

  /**
   * Public decrypt (mock) - return "decrypted" values
   */
  async publicDecrypt(handles) {
    const clearValues = {};
    const decodedValues = [];

    for (const handle of handles) {
      const value = this._retrieveCiphertext(handle);
      clearValues[handle] = value;
      decodedValues.push(value);
    }

    // Mock ABI encoding
    const abiEncodedClearValues = `0x${Buffer.from(JSON.stringify(decodedValues)).toString('hex')}`;

    // Mock decryption proof
    const decryptionProof = `0x${crypto.randomBytes(64).toString('hex')}`;

    return {
      clearValues,
      abiEncodedClearValues,
      decryptionProof
    };
  }

  /**
   * User decrypt (mock)
   */
  async userDecrypt(handleContractPairs, privateKey, publicKey, signature, contractAddresses, userAddress, startTimeStamp, durationDays) {
    const result = {};

    for (const pair of handleContractPairs) {
      const value = this._retrieveCiphertext(pair.handle);
      result[pair.handle] = value;
    }

    return result;
  }

  /**
   * Create EIP-712 message (mock)
   */
  createEIP712(publicKey, contractAddresses, startTimeStamp, durationDays) {
    return {
      domain: {
        name: 'FHEVMUserDecrypt',
        version: '1',
        chainId: 11155111
      },
      types: {
        UserDecryptRequestVerification: [
          { name: 'publicKey', type: 'bytes' },
          { name: 'contractAddresses', type: 'address[]' },
          { name: 'startTime', type: 'uint256' },
          { name: 'duration', type: 'uint256' }
        ]
      },
      message: {
        publicKey,
        contractAddresses,
        startTime: startTimeStamp,
        duration: durationDays
      }
    };
  }

  /**
   * Generate a unique ciphertext handle
   * @private
   */
  _generateHandle() {
    const handle = `0x${crypto.randomBytes(32).toString('hex')}${(this.nextHandle++).toString(16).padStart(4, '0')}`;
    return handle;
  }

  /**
   * Store ciphertext (mock storage)
   * @private
   */
  _storeCiphertext(handle, value) {
    this.ciphertexts.set(handle, value);
  }

  /**
   * Retrieve ciphertext (mock retrieval)
   * @private
   */
  _retrieveCiphertext(handle) {
    if (!this.ciphertexts.has(handle)) {
      // Generate mock value if not found
      return BigInt(Math.floor(Math.random() * 1000));
    }
    return this.ciphertexts.get(handle);
  }

  /**
   * Homomorphic addition (mock)
   */
  add(ct1, ct2) {
    const v1 = this._retrieveCiphertext(ct1);
    const v2 = this._retrieveCiphertext(ct2);
    const result = BigInt(v1) + BigInt(v2);
    const handle = this._generateHandle();
    this._storeCiphertext(handle, result);
    return handle;
  }

  /**
   * Homomorphic subtraction (mock)
   */
  sub(ct1, ct2) {
    const v1 = this._retrieveCiphertext(ct1);
    const v2 = this._retrieveCiphertext(ct2);
    const result = BigInt(v1) - BigInt(v2);
    const handle = this._generateHandle();
    this._storeCiphertext(handle, result);
    return handle;
  }

  /**
   * Encrypt a plaintext value (mock)
   */
  encrypt(value, publicKey) {
    const handle = this._generateHandle();
    this._storeCiphertext(handle, BigInt(value));
    return handle;
  }

  /**
   * Decrypt a ciphertext (mock)
   */
  decrypt(handle, privateKey) {
    return this._retrieveCiphertext(handle);
  }
}

// Singleton instance
const fheShim = new FHEShim();

module.exports = fheShim;
