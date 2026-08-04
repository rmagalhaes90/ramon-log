import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require('firebase-tools/lib/auth');

const project = 'traincontrollog';
const expectedDomain = 'rmagalhaes90.github.io';
const account = getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error('Firebase CLI login required');
const credentials = await getAccessToken(account.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform',
]);
const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
const headers = {
  authorization: `Bearer ${credentials.access_token}`,
  'content-type': 'application/json',
};
const response = await fetch(url, { headers });
if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
const config = await response.json();
const domains = config.authorizedDomains ?? [];
const configured = domains.includes(expectedDomain);
console.log(`${expectedDomain} authorized=${configured}`);

if (process.argv.includes('--apply') && !configured) {
  const update = await fetch(`${url}?updateMask=authorizedDomains`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ authorizedDomains: [...domains, expectedDomain] }),
  });
  if (!update.ok) throw new Error(`${update.status} ${await update.text()}`);
  console.log(`${expectedDomain} updated=true`);
}
