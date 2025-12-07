const { expect } = require('chai');
const sinon = require('sinon');
const CustomError = require('../../utils/CustomError');

describe('CustomError', () => {
  it('should create error with message and status code', () => {
    const error = new CustomError('Test error', 400);

    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.equal('Test error');
    expect(error.statusCode).to.equal(400);
    expect(error.isOperational).to.be.true;
  });

  it('should default to status code 500', () => {
    const error = new CustomError('Test error');

    expect(error.statusCode).to.equal(500);
  });

  it('should include metadata', () => {
    const metadata = { userId: '123', action: 'test' };
    const error = new CustomError('Test error', 400, metadata);

    expect(error.metadata).to.deep.equal(metadata);
  });

  it('should capture stack trace', () => {
    const error = new CustomError('Test error', 400);

    expect(error.stack).to.be.a('string');
    expect(error.stack).to.include('CustomError');
  });
});
