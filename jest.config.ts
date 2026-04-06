import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'commonjs',
        moduleResolution: 'node10',
        ignoreDeprecations: '6.0',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'react-jsx',
        rootDir: '.',
        paths: { '@/*': ['./src/*'] },
      },
    }],
  },
};

export default config;
