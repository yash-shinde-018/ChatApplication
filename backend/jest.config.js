module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**'
  ],
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    }
  }
};
