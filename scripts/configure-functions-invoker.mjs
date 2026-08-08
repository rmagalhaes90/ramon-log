import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require('firebase-tools/lib/auth');

const project = 'traincontrollog';
const location = 'us-central1';
const expected = new Set(['deleteownaccount', 'getentitlements', 'setadminrole', 'setuserblocked']);
const account = getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error('Firebase CLI login required');
const credentials = await getAccessToken(account.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform',
]);
const headers = {
  authorization: `Bearer ${credentials.access_token}`,
  'content-type': 'application/json',
};
const prefix = `https://run.googleapis.com/v2/projects/${project}/locations/${location}`;
const request = async (url, init = {}) => {
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
};
const listed = await request(`${prefix}/services`);
const services = (listed.services ?? []).filter(({ name }) => expected.has(name.split('/').at(-1)));
if (services.length !== expected.size)
  throw new Error(`Expected ${expected.size} services, found ${services.length}`);

for (const service of services) {
  const policyUrl = `https://run.googleapis.com/v2/${service.name}:getIamPolicy`;
  const policy = await request(policyUrl, { method: 'GET' });
  const binding = policy.bindings?.find(({ role }) => role === 'roles/run.invoker');
  const isPublic = binding?.members?.includes('allUsers') ?? false;
  console.log(`${service.name.split('/').at(-1)} public=${isPublic}`);
  if (process.argv.includes('--apply') && !isPublic) {
    const bindings = policy.bindings ?? [];
    if (binding) binding.members = [...new Set([...(binding.members ?? []), 'allUsers'])];
    else bindings.push({ role: 'roles/run.invoker', members: ['allUsers'] });
    await request(`https://run.googleapis.com/v2/${service.name}:setIamPolicy`, {
      method: 'POST',
      body: JSON.stringify({ policy: { ...policy, bindings } }),
    });
    console.log(`${service.name.split('/').at(-1)} updated=true`);
  }
}
