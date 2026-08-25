import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['out/**', 'node_modules/**', 'dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  {
    files: ['src/main/observe/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'net', message: 'observe zone is read-only: no sockets (spec §5.1)' },
          { name: 'node:net', message: 'observe zone is read-only: no sockets (spec §5.1)' },
          { name: 'child_process', message: 'observe zone must not spawn; use the ProcessProbe interface' },
          { name: 'node:child_process', message: 'observe zone must not spawn; use the ProcessProbe interface' },
          { name: 'fs', importNames: ['writeFile','writeFileSync','appendFile','appendFileSync','rm','rmSync','unlink','unlinkSync','rename','renameSync','createWriteStream','truncate','truncateSync','mkdir','mkdirSync'], message: 'observe zone is read-only (spec §5.1)' },
          { name: 'node:fs', importNames: ['writeFile','writeFileSync','appendFile','appendFileSync','rm','rmSync','unlink','unlinkSync','rename','renameSync','createWriteStream','truncate','truncateSync','mkdir','mkdirSync'], message: 'observe zone is read-only (spec §5.1)' },
          { name: 'fs/promises', importNames: ['writeFile','writeFileSync','appendFile','appendFileSync','rm','rmSync','unlink','unlinkSync','rename','renameSync','createWriteStream','truncate','truncateSync','mkdir','mkdirSync'], message: 'observe zone is read-only (spec §5.1)' },
          { name: 'node:fs/promises', importNames: ['writeFile','writeFileSync','appendFile','appendFileSync','rm','rmSync','unlink','unlinkSync','rename','renameSync','createWriteStream','truncate','truncateSync','mkdir','mkdirSync'], message: 'observe zone is read-only (spec §5.1)' },
        ],
      }],
      'no-restricted-properties': ['error',
        ...['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'rm', 'rmSync', 'unlink', 'unlinkSync',
            'rename', 'renameSync', 'createWriteStream', 'truncate', 'truncateSync']
          .map((p) => ({ object: 'fs', property: p, message: 'observe zone is read-only (spec §5.1)' })),
      ],
    },
  },
);
