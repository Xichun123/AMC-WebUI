#!/usr/bin/env node
import { createSitePasswordHash } from '../server/dist/siteAuth.js';

const password = process.argv[2];

if (typeof password !== 'string' || password.length === 0) {
  console.error('Usage: npm run auth:hash -- "password"');
  process.exit(1);
}

console.log(await createSitePasswordHash(password));
