const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');
const CustomError = require('../utils/CustomError');
const { encryptPrivateKey, decryptPrivateKey } = require('../utils/crypto');
const relayerService = require('../fhe/relayerService');

/**
 * User Service
 * Business logic for user management and authentication
 *
 * Key operations:
 * - Register: create user + generate FHE keypair + encrypt private key
 * - Login: validate credentials + issue JWT
 * - Decrypt key: verify password + return plaintext private key
 */

class UserService {
  /**
   * Register a new user
   * Generates FHE keypair and encrypts private key with password
   *
   * @param {Object} userData - { username, email, password }
   * @param {Object} requestMeta - { ipAddress, userAgent }
   * @returns {Promise<Object>} { user, token }
   */
  async register(userData, requestMeta = {}) {
    const { username, email, password } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new CustomError('Email already registered', 409);
      }
      if (existingUser.username === username) {
        throw new CustomError('Username already taken', 409);
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);

    // Generate FHE keypair using relayer SDK
    logger.info('Generating FHE keypair for new user');
    const keypair = relayerService.generateKeypair();

    // Encrypt private key with user's password
    const encryptedPrivateKey = await encryptPrivateKey(keypair.privateKey, password);

    // Create user record
    const user = await User.create({
      username,
      email,
      passwordHash,
      publicKey: keypair.publicKey,
      encryptedPrivateKey,
      role: 'user'
    });

    // Audit log
    await AuditLog.create({
      userId: user._id,
      action: 'USER_REGISTER',
      data: { email, username },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent
    });

    // Generate JWT
    const token = this._generateToken(user);

    logger.info(`User registered: ${user.id}`);

    return {
      user: user.toJSON(),
      token
    };
  }

  /**
   * Authenticate user and issue JWT
   *
   * @param {string} email
   * @param {string} password
   * @param {Object} requestMeta
   * @returns {Promise<Object>} { user, token }
   */
  async login(email, password, requestMeta = {}) {
    // Find user by email
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      // Audit failed login attempt
      await AuditLog.create({
        action: 'AUTH_FAILED',
        data: { email, reason: 'User not found' },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        success: false
      });
      throw new CustomError('Invalid credentials', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new CustomError('Account is disabled', 403);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Audit failed login attempt
      await AuditLog.create({
        userId: user._id,
        action: 'AUTH_FAILED',
        data: { email, reason: 'Invalid password' },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        success: false
      });
      throw new CustomError('Invalid credentials', 401);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Audit successful login
    await AuditLog.create({
      userId: user._id,
      action: 'USER_LOGIN',
      data: { email },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent
    });

    // Generate JWT
    const token = this._generateToken(user);

    logger.info(`User logged in: ${user.id}`);

    return {
      user: user.toJSON(),
      token
    };
  }

  /**
   * Decrypt user's private key
   * Requires password verification
   *
   * SECURITY CRITICAL:
   * - Private key decrypted in memory only
   * - Returned to client for session use
   * - Never persisted in plaintext
   * - All requests audited
   *
   * @param {string} userId
   * @param {string} password
   * @param {Object} requestMeta
   * @returns {Promise<string>} Plaintext private key
   */
  async decryptUserPrivateKey(userId, password, requestMeta = {}) {
    // Fetch user with encrypted private key
    const user = await User.findById(userId).select('+encryptedPrivateKey +passwordHash');

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Audit failed attempt
      await AuditLog.create({
        userId: user._id,
        action: 'KEY_DECRYPT_REQUEST',
        data: { success: false, reason: 'Invalid password' },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        success: false
      });
      throw new CustomError('Invalid password', 401);
    }

    // Decrypt private key
    let privateKey;
    try {
      privateKey = await decryptPrivateKey(user.encryptedPrivateKey, password);
    } catch (error) {
      logger.error('Private key decryption failed:', error);
      throw new CustomError('Failed to decrypt private key', 500);
    }

    // Audit successful decryption
    await AuditLog.create({
      userId: user._id,
      action: 'KEY_DECRYPT_REQUEST',
      data: { success: true },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent
    });

    logger.info(`Private key decrypted for user: ${user.id}`);

    return privateKey;
  }

  /**
   * Get user's public key
   *
   * @param {string} userId
   * @returns {Promise<string>} Public key
   */
  async getUserPublicKey(userId) {
    const user = await User.findById(userId).select('publicKey');

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    return user.publicKey;
  }

  /**
   * Get user profile
   *
   * @param {string} userId
   * @returns {Promise<Object>} User object
   */
  async getUserProfile(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    return user.toJSON();
  }

  /**
   * Generate JWT token
   * @private
   */
  _generateToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiry
      }
    );
  }
}

module.exports = new UserService();
