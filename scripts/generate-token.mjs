#!/usr/bin/env node
// Generate a signed preview token for any partner
// Usage: JWT_SECRET=your_secret node scripts/generate-token.mjs kath-janisch
//        JWT_SECRET=your_secret node scripts/generate-token.mjs james-grant 7

import { createHmac } from 'crypto';

const key = process.argv[2];
const expiryDays = parseInt(process.argv[3] || '30', 10);
const secret = process.env.JWT_SECRET;

if (!key || !secret) {
  console.error('Usage: JWT_SECRET=<secret> node scripts/generate-token.mjs <partner-key> [expiryDays]');
  process.exit(1);
}

const EMAIL_MAP = {
  'kath-janisch':  'kath@ctrlfuture.co.za',
  'james-grant':   'jamesgrant321@proton.me',
  'robert-fairon': 'robert.fairon@daemon.com',
  'hyram':         'hyramserretta20@gmail.com',
  'carla':         'carladeabreu@outlook.com',
  'nicola':        'nicola@gananda.net',
};

const email = EMAIL_MAP[key];
if (!email) {
  console.error(`Unknown partner key: ${key}`);
  console.error('Known keys:', Object.keys(EMAIL_MAP).join(', '));
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const payload = JSON.stringify({
  k: key,
  e: email.toLowerCase(),
  exp: Math.floor(Date.now() / 1000) + expiryDays * 86400,
});
const payloadB64 = b64url(Buffer.from(payload));

const sig = createHmac('sha256', secret).update(payloadB64).digest();
const token = `${payloadB64}.${b64url(sig)}`;

const siteUrl = process.env.SITE_URL || 'https://developers-2nth-ai.pages.dev';
const tokenUrl = `${siteUrl}/partners/${key}?token=${token}`;
const expiresAt = new Date(Date.now() + expiryDays * 86400 * 1000).toISOString();

console.log('\n--- Preview Token ---');
console.log(`Partner : ${key}`);
console.log(`Email   : ${email}`);
console.log(`Expires : ${expiresAt}`);
console.log(`\nToken URL:\n${tokenUrl}\n`);
