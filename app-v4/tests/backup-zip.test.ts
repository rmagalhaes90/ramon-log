import { describe, expect, it } from 'vitest';
import { createZip, readZip } from '../src/features/backup/zip';

describe('backup zip archive', () => {
  it('round-trips text and binary entries with exact bytes', () => {
    const jsonBytes = new TextEncoder().encode(JSON.stringify({ hello: 'world' }));
    const photoBytes = new Uint8Array(4096).map((_, i) => i % 256);
    const zip = createZip([
      { name: 'backup.json', data: jsonBytes },
      { name: 'photos/a.jpg', data: photoBytes },
    ]);
    const entries = readZip(zip);
    expect(entries).toHaveLength(2);
    const [backup, photo] = entries;
    expect(backup?.name).toBe('backup.json');
    expect(backup?.data).toEqual(jsonBytes);
    expect(photo?.name).toBe('photos/a.jpg');
    expect(photo?.data).toEqual(photoBytes);
  });

  it('round-trips an empty archive and empty files', () => {
    expect(readZip(createZip([]))).toEqual([]);
    const entries = readZip(createZip([{ name: 'empty.txt', data: new Uint8Array(0) }]));
    expect(entries).toEqual([{ name: 'empty.txt', data: new Uint8Array(0) }]);
  });

  it('rejects malformed or truncated archives', () => {
    expect(() => readZip(new Uint8Array([1, 2, 3]))).toThrow('zipInvalid');
    const zip = createZip([{ name: 'a.txt', data: new Uint8Array([1, 2, 3]) }]);
    expect(() => readZip(zip.slice(0, zip.length - 10))).toThrow('zipInvalid');
  });
});
