#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/*
 * Sync repo-root /.well-known to apps/remix/public/.well-known.
 *
 * NOTE: The Remix static server serves /.well-known/* from apps/remix/public/.
 * The repo-root .well-known/ is retained as the "source of truth" so that
 * security.txt and friends are visible at the top of the repo. Whenever you
 * edit repo-root .well-known/*, run this script (or `npm run wellknown:sync`)
 * so the public copy stays in lockstep.
 *
 * This script is NOT run inside the Docker build, because turbo prune filters
 * out files not referenced in a package.json. Keep both files in sync at
 * commit-time instead. A pre-commit hook can enforce this — see package.json.
 */

const path = require('path');
const fs = require('fs');

const src = path.join(__dirname, '../.well-known');
const dst = path.join(__dirname, '../apps/remix/public/.well-known');

console.log(`[copy-wellknown] ${src} → ${dst}`);
fs.cpSync(src, dst, { recursive: true });
console.log('[copy-wellknown] done.');
