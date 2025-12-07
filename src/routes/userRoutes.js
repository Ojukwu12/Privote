const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { validate, userSchemas } = require('../middleware/validate');
const { authLimiter, keyDecryptLimiter } = require('../middleware/rateLimiter');
const userController = require('../controllers/userController');

const router = express.Router();

/**
 * User Routes
 * Authentication and key management
 */

// POST /users/register - Register new user
router.post(
  '/register',
  authLimiter,
  validate(userSchemas.register),
  userController.register
);

// POST /users/login - Authenticate user
router.post(
  '/login',
  authLimiter,
  validate(userSchemas.login),
  userController.login
);

// GET /users/profile - Get authenticated user profile
router.get(
  '/profile',
  authenticate,
  userController.getProfile
);

// GET /keys/public - Get user's public FHE key
router.get(
  '/public',
  authenticate,
  userController.getPublicKey
);

// POST /keys/decrypt - Decrypt user's private FHE key
router.post(
  '/decrypt',
  authenticate,
  keyDecryptLimiter,
  validate(userSchemas.decryptKey),
  userController.decryptPrivateKey
);

module.exports = router;
