import { readFile } from 'node:fs/promises';
import { describe,expect,it } from 'vitest';

describe('PWA release',()=>{
  it('keeps package, version manifest and worker aligned',async()=>{
    const packageJson=JSON.parse(await readFile('package.json','utf8')) as {version:string};
    const versionJson=JSON.parse(await readFile('app-v4/public/version.json','utf8')) as {build:string};
    const worker=await readFile('app-v4/public/sw.js','utf8');
    expect(versionJson.build).toBe(packageJson.version);expect(worker).toContain(`const VERSION = '${packageJson.version}'`);
  });
  it('runtime-caches hashed application assets',async()=>{const worker=await readFile('app-v4/public/sw.js','utf8');expect(worker).toContain("'script', 'style', 'image', 'font', 'manifest'");expect(worker).toContain('cache.put(event.request, response.clone())');});
});
