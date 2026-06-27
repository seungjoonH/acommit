module.exports = {
  testEnvironment: 'node',
  transform: {},
  verbose: true,
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/eval/',
    '<rootDir>/__tests__/commit-suites.test.js',
  ],
  moduleNameMapper: {
    '^openai$': '<rootDir>/__mocks__/openai.mock.js',
    '^@google/generative-ai$': '<rootDir>/__mocks__/genai.mock.js'
  }
};
