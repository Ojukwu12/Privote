const Joi = require('joi');
const CustomError = require('../utils/CustomError');

/**
 * Validation Middleware using Joi
 * Validates request body, query params, or route params
 *
 * Usage:
 *   const schema = Joi.object({ email: Joi.string().email().required() });
 *   router.post('/register', validate(schema), handler);
 */

/**
 * Validate request data against Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} source - Source of data: 'body' | 'query' | 'params'
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];

    const { error, value } = schema.validate(data, {
      abortEarly: false, // Return all errors
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      throw new CustomError('Validation failed', 400, { errors });
    }

    // Replace request data with validated/sanitized data
    req[source] = value;
    next();
  };
};

/**
 * Common validation schemas
 */

const userSchemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  decryptKey: Joi.object({
    password: Joi.string().required()
  })
};

const proposalSchemas = {
  create: Joi.object({
    title: Joi.string().min(5).max(200).required(),
    description: Joi.string().min(10).max(2000).required(),
    startTime: Joi.date().iso().greater('now').required(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
    requiredRole: Joi.string().valid('user', 'admin').default('user')
  }),

  id: Joi.object({
    id: Joi.string().hex().length(24).required()
  })
};

const voteSchemas = {
  submit: Joi.object({
    proposalId: Joi.string().hex().length(24).required(),
    encryptedVote: Joi.string().required(),
    inputProof: Joi.string().optional(),
    idempotencyKey: Joi.string().uuid().optional()
  })
};

module.exports = {
  validate,
  userSchemas,
  proposalSchemas,
  voteSchemas
};
