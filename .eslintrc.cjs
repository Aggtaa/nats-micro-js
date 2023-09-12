const { resolve } = require('path');

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  globals: {
    NodeJS: true,
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'chai-friendly', 'import', 'mocha', 'i18next'],
  env: {
    browser: false,
    node: true,
  },
  ignorePatterns: ['dist/**', 'lib/**', 'examples/**'],
  overrides: [
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
    {
      files: ['html/**/*'],
      env: {
        browser: true,
        jquery: true,
      },
      globals: {
        io: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['**/*.test.ts', '**/*.test.include.ts'],
      env: {
        mocha: true,
      },
      rules: {
        'no-unused-expressions': 'off',
        'chai-friendly/no-unused-expressions': 'error',
        '@typescript-eslint/explicit-function-return-type': [
          'error',
          { allowExpressions: true, allowTypedFunctionExpressions: true },
        ],
        'prefer-arrow-callback': 'off',
        'mocha/no-hooks-for-single-case': 'off',
        //                "func-style": ["error", "declaration", {"allowArrowFunctions": false}],
        'func-names': 'off',
        'mocha/no-pending-tests': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'global-require': 'off',
        'mocha/no-setup-in-describe': 'off',
        'mocha/no-exclusive-tests': 'error',
        'i18next/no-literal-string': 'off',
      },
    },
    {
      files: ['migrations/**/*.js'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'no-useless-escape': 'off',
        'no-octal-escape': 'off',
        'global-require': 'off',
        'i18next/no-literal-string': 'off',
      },
    },
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'airbnb-base',
    'plugin:mocha/recommended',
  ],
  settings: {
    react: {
      // fix for annoying warning
      // Warning: React version was set to "detect" in eslint-plugin-react settings, but the "react" package is not installed. Assuming latest React version for linting.
      // https://github.com/DRD4-7R/eslint-config-7r-building/issues/1
      version: '999.999.999',
    },
    'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      'eslint-import-resolver-lerna': {
        packages: [
          resolve(__dirname, '../..'),
          __dirname,
        ],
      },
      typescript: {
        project: '**/tsconfig.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        groups: [['builtin', 'external'], ['internal', 'index', 'parent', 'sibling'], 'unknown'],
        pathGroups: [
          {
            pattern: '(utils|global|packages|providers|services|types)/**/*',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '*.css',
            patternOptions: { matchBase: true },
            group: 'unknown',
            position: 'after',
          },
          {
            pattern: '*.scss',
            patternOptions: { matchBase: true },
            group: 'unknown',
            position: 'after',
          },
        ],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'max-len': [
      'error',
      {
        code: 100,
        ignoreComments: true,
        ignoreTrailingComments: true,
        ignoreTemplateLiterals: true,
        ignoreStrings: true,
        ignoreUrls: true,
      },
    ],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        ts: 'never',
        tsx: 'never',
        js: 'never',
        jsx: 'never',
      },
    ],
    indent: ['error', 2, { SwitchCase: 1 }],
    // import/no-extraneous-dependencies does not support npm workspaces
    // see https://github.com/import-js/eslint-plugin-import/issues/1174
    'import/no-extraneous-dependencies': 'off',
    'dot-notation': 'off',
    'no-case-declarations': 'off',
    'no-console': 'error',
    semi: 'error',
    'no-lonely-if': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    // 'max-len': ['error', { 'code': 100, "ignoreTrailingComments": true, "ignoreTemplateLiterals": true }],
    'max-classes-per-file': 'off',
    'import/prefer-default-export': 'off',
    'spaced-comment': ['error', 'always', { exceptions: ['TODO', 'DEBUG', 'IMPLEMENT', 'FIXME'] }],
    'jest/no-hooks': 'off',
    'prefer-template': 'off',
    'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
    'object-shorthand': 'off',
    'class-methods-use-this': 'off',
    'new-cap': ['error', { newIsCapExceptions: ['type'], capIsNewExceptions: ['Router'] }],
    'no-dupe-class-members': 'off',
    'no-plusplus': 'off',
    'no-loop-func': 'off',
    'prefer-destructuring': 'off',
    'no-unused-vars': 'off', // duplicated by @typescript-eslint/no-unused-vars
    // 'import/no-cycle': 'off',
    'no-await-in-loop': 'off',
    'padded-blocks': 'off',
    'no-param-reassign': 'off',
    'operator-linebreak': 'off',
    'no-underscore-dangle': 'off',
    'nonblock-statement-body-position': ['error', 'below'],
    curly: 'off',
    'implicit-arrow-linebreak': 'off',
    'brace-style': ['error', 'stroustrup', { allowSingleLine: false }],
    'func-names': 'off',
    'no-useless-constructor': 'off',
    'prefer-arrow-callback': 'off',
    'no-return-assign': 'off',
    'no-sequences': 'off',
    'no-prototype-builtins': 'off',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/typedef': [
      'off',
      {
        arrowParameter: true,
        variableDeclaration: true,
        variableDeclarationIgnoreFunction: false,
      },
    ],
    'no-return-await': 'off',
    'no-restricted-syntax': [
      'error',
      'ForInStatement',
      'LabeledStatement',
      'WithStatement',
      // ForOfStatement is not an error
    ],
    'no-continue': 'off',
    camelcase: 'off',
    'i18next/no-literal-string': [
      'error',
      {
        validateTemplate: true,
        ignoreCallee: [
          'require',
          'on',
          'off',
          'db.collection',
          'routes',
          'route',
          'dt.isSame',
          'hbs.registerHelper',
          'path.join',
          'join',
          'formatDate',
          'log.error',
          'log.verbose',
          'log.warn',
          'log.debug',
          'log.info',
          'log.silly',
          'res.render',
          'res.cookie',
          'res.redirect',
          'res.header',
          'res.attachment',
          'adminApi.systemAction',
          'AuthenticationResponse.ui',
          'AuthenticationResponse.redirect',
          'addClass',
        ],
        ignore: [
          'base64',
          '^user/',
          '^users',
          '^users/',
          '^workspace/',
          '^workspaces',
          '^exportConfig',
          '^system/',
          '^config/',
          '^localization/',
          '^application/json$',
          '^utf-8$',
          '^.error',
          'admin',
          'serviceadmin',
        ],
        ignoreProperty: [
          'redirect',
          'driver',
          'roles',
          'type',
          'template',
          'autocomplete',
          'action',
        ],
      },
    ],
  },
};
