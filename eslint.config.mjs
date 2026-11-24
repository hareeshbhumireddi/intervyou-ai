import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'instance/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
