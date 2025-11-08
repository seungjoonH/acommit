module.exports = {
  testEnvironment: 'node',
  transform: {},
  verbose: true,
  moduleNameMapper: {
    '^openai$': '<rootDir>/__mocks__/openai.mock.js',
    '^@google/generative-ai$': '<rootDir>/__mocks__/genai.mock.js'
  }
};
