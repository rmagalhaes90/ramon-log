import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require('firebase-tools/lib/auth');
const project = 'traincontrollog';
const domain = 'thingsofthings.ie';
const action = process.argv.includes('--apply-domain') ? 'APPLY' : 'VERIFY';
const account = getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error('Firebase CLI login required');
const credentials = await getAccessToken(account.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform',
]);
const headers = {
  authorization: `Bearer ${credentials.access_token}`,
  'content-type': 'application/json',
};
const response = await fetch(
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/domain:verify`,
  { method: 'POST', headers, body: JSON.stringify({ domain, action }) },
);
const result = await response.json();
if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(result)}`);
console.log(`domain=${domain}`);
console.log(`action=${action}`);
console.log(`verificationState=${result.verificationState ?? 'unknown'}`);
if (result.verificationError) console.log(`verificationError=${result.verificationError}`);
