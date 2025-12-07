const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const app = require('../../server');
const { User } = require('../../models');
const config = require('../../config');

/**
 * Integration Tests - User Authentication Flow
 * Tests full registration and login flow
 */

describe('User Authentication Integration', () => {
  before(async () => {
    // Set mock mode for testing
    process.env.RELAYER_MOCK = 'true';
    await mongoose.connect(config.mongoUri.replace('privote', 'privote-test'));
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/users/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'alice',
        email: 'alice@example.com',
        password: 'SecurePass123!'
      };

      const res = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property('user');
      expect(res.body.data).to.have.property('token');
      expect(res.body.data.user.username).to.equal(userData.username);
      expect(res.body.data.user.email).to.equal(userData.email);
      expect(res.body.data.user).to.have.property('publicKey');
    });

    it('should reject duplicate email', async () => {
      const userData = {
        username: 'alice',
        email: 'alice@example.com',
        password: 'SecurePass123!'
      };

      // Register first user
      await request(app)
        .post('/api/users/register')
        .send(userData);

      // Try to register again with same email
      const res = await request(app)
        .post('/api/users/register')
        .send({ ...userData, username: 'bob' })
        .expect(409);

      expect(res.body.success).to.be.false;
      expect(res.body.message).to.include('Email already registered');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'alice',
          email: 'invalid-email',
          password: 'SecurePass123!'
        })
        .expect(400);

      expect(res.body.success).to.be.false;
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'weak'
        })
        .expect(400);

      expect(res.body.success).to.be.false;
    });
  });

  describe('POST /api/users/login', () => {
    let registeredUser;

    beforeEach(async () => {
      // Register a user first
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'SecurePass123!'
        });

      registeredUser = res.body.data;
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: 'alice@example.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property('token');
      expect(res.body.data.user.email).to.equal('alice@example.com');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: 'alice@example.com',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(res.body.success).to.be.false;
      expect(res.body.message).to.include('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: 'nobody@example.com',
          password: 'SomePassword'
        })
        .expect(401);

      expect(res.body.success).to.be.false;
    });
  });

  describe('GET /api/users/profile', () => {
    let token;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'SecurePass123!'
        });

      token = res.body.data.token;
    });

    it('should get profile with valid token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.data.user.username).to.equal('alice');
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(res.body.success).to.be.false;
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body.success).to.be.false;
    });
  });

  describe('POST /api/keys/decrypt', () => {
    let token;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'SecurePass123!'
        });

      token = res.body.data.token;
    });

    it('should decrypt private key with correct password', async () => {
      const res = await request(app)
        .post('/api/keys/decrypt')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'SecurePass123!' })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property('privateKey');
      expect(res.body.data.privateKey).to.be.a('string');
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/keys/decrypt')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'WrongPassword' })
        .expect(401);

      expect(res.body.success).to.be.false;
    });
  });
});
