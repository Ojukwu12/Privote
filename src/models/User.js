const mongoose = require('mongoose');

/**
 * User Model
 * Stores user credentials, FHE key pair, and encrypted private key
 *
 * Security notes:
 * - passwordHash: bcrypt hash, never store plaintext
 * - publicKey: FHE public key (hex string), safe to expose
 * - encryptedPrivateKey: AES-256-GCM encrypted with password-derived key
 *   - iv: initialization vector (hex)
 *   - salt: unique per-user salt for key derivation (hex)
 *   - data: encrypted private key ciphertext (hex)
 *   - authTag: GCM authentication tag (hex)
 */

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_-]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  passwordHash: {
    type: String,
    required: true
  },
  publicKey: {
    type: String,
    required: true
  },
  encryptedPrivateKey: {
    iv: {
      type: String,
      required: true
    },
    salt: {
      type: String,
      required: true
    },
    data: {
      type: String,
      required: true
    },
    authTag: {
      type: String,
      required: true
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.encryptedPrivateKey;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
