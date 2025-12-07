const { expect } = require('chai');
const mongoose = require('mongoose');
const { User } = require('../../models');
const config = require('../../config');

describe('User Model', () => {
  before(async () => {
    // Connect to test database
    await mongoose.connect(config.mongoUri.replace('privote', 'privote-test'));
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  it('should create a valid user', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
      publicKey: '0xPUB_test123',
      encryptedPrivateKey: {
        iv: 'testiv',
        salt: 'testsalt',
        data: 'testdata',
        authTag: 'testauthTag'
      }
    };

    const user = await User.create(userData);

    expect(user.username).to.equal(userData.username);
    expect(user.email).to.equal(userData.email);
    expect(user.publicKey).to.equal(userData.publicKey);
    expect(user.role).to.equal('user');
    expect(user.isActive).to.be.true;
  });

  it('should not allow duplicate email', async () => {
    const userData = {
      username: 'user1',
      email: 'test@example.com',
      passwordHash: 'hash',
      publicKey: '0xPUB_1',
      encryptedPrivateKey: {
        iv: 'iv', salt: 'salt', data: 'data', authTag: 'tag'
      }
    };

    await User.create(userData);

    try {
      await User.create({ ...userData, username: 'user2' });
      expect.fail('Should have thrown duplicate error');
    } catch (error) {
      expect(error.code).to.equal(11000);
    }
  });

  it('should remove sensitive fields from JSON', async () => {
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
      publicKey: '0xPUB_test',
      encryptedPrivateKey: {
        iv: 'iv', salt: 'salt', data: 'data', authTag: 'tag'
      }
    });

    const userJSON = user.toJSON();

    expect(userJSON).to.not.have.property('passwordHash');
    expect(userJSON).to.not.have.property('encryptedPrivateKey');
    expect(userJSON).to.not.have.property('__v');
    expect(userJSON).to.have.property('username');
  });
});
