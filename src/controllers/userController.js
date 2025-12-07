const userService = require('../services/userService');
const asyncHandler = require('../utils/asyncHandler');
const CustomError = require('../utils/CustomError');

/**
 * User Controller
 * HTTP handlers for user-related endpoints
 *
 * Frontend integration notes:
 * - All endpoints return JSON with { success, data/message }
 * - JWT token returned on register/login - store securely (localStorage/sessionStorage)
 * - Include token in Authorization header for protected routes
 * - Private key decryption requires password - store result in memory only
 */

/**
 * POST /users/register
 * Register a new user
 *
 * Body:
 * {
 *   "username": "alice",
 *   "email": "alice@example.com",
 *   "password": "SecurePass123!"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": { "id": "...", "username": "alice", "email": "...", "publicKey": "..." },
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   },
 *   "message": "User registered successfully"
 * }
 */
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  const requestMeta = {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  };

  const result = await userService.register(
    { username, email, password },
    requestMeta
  );

  res.status(201).json({
    success: true,
    data: result,
    message: 'User registered successfully'
  });
});

/**
 * POST /users/login
 * Authenticate user
 *
 * Body:
 * {
 *   "email": "alice@example.com",
 *   "password": "SecurePass123!"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": { "id": "...", "username": "alice", ... },
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   },
 *   "message": "Login successful"
 * }
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const requestMeta = {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  };

  const result = await userService.login(email, password, requestMeta);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Login successful'
  });
});

/**
 * GET /users/profile
 * Get authenticated user's profile
 * Requires: JWT authentication
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": { "id": "...", "username": "alice", "email": "...", "publicKey": "..." }
 *   }
 * }
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getUserProfile(req.user.id);

  res.status(200).json({
    success: true,
    data: { user }
  });
});

/**
 * GET /keys/public
 * Get authenticated user's FHE public key
 * Requires: JWT authentication
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "publicKey": "0xPUB_..."
 *   }
 * }
 */
const getPublicKey = asyncHandler(async (req, res) => {
  const publicKey = await userService.getUserPublicKey(req.user.id);

  res.status(200).json({
    success: true,
    data: { publicKey }
  });
});

/**
 * POST /keys/decrypt
 * Decrypt user's FHE private key
 * Requires: JWT authentication
 *
 * SECURITY WARNING:
 * - Private key returned in response - handle with care
 * - Store in memory only, never persist
 * - Use for encrypting votes in current session
 * - Clear from memory when no longer needed
 *
 * Body:
 * {
 *   "password": "SecurePass123!"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "privateKey": "0xPRIV_..."
 *   },
 *   "message": "Private key decrypted successfully. Handle with care."
 * }
 */
const decryptPrivateKey = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw new CustomError('Password is required', 400);
  }

  const requestMeta = {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  };

  const privateKey = await userService.decryptUserPrivateKey(
    req.user.id,
    password,
    requestMeta
  );

  res.status(200).json({
    success: true,
    data: { privateKey },
    message: 'Private key decrypted successfully. Handle with care.'
  });
});

module.exports = {
  register,
  login,
  getProfile,
  getPublicKey,
  decryptPrivateKey
};
