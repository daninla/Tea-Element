module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.spec.ts', '**/src/**/*.spec.tsx'],
  clearMocks: true,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', moduleResolution: 'node', jsx: 'react-jsx' } },
    ],
  },
};
