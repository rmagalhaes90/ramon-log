export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i] ?? 0;
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function writeUint16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

/** Builds an uncompressed (STORE method) ZIP archive, sufficient for bundling JPEGs that are already compressed. */
export function createZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = entries.map((entry) => ({
    nameBytes: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
  }));

  const localParts: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  for (const entry of encoded) {
    offsets.push(cursor);
    const header = new Uint8Array(30 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    writeUint32LE(view, 0, 0x04034b50);
    writeUint16LE(view, 4, 20);
    writeUint16LE(view, 6, 0);
    writeUint16LE(view, 8, 0);
    writeUint16LE(view, 10, 0);
    writeUint16LE(view, 12, 0);
    writeUint32LE(view, 14, entry.crc);
    writeUint32LE(view, 18, entry.data.length);
    writeUint32LE(view, 22, entry.data.length);
    writeUint16LE(view, 26, entry.nameBytes.length);
    writeUint16LE(view, 28, 0);
    header.set(entry.nameBytes, 30);
    localParts.push(header, entry.data);
    cursor += header.length + entry.data.length;
  }

  const centralParts: Uint8Array[] = [];
  let centralSize = 0;
  encoded.forEach((entry, index) => {
    const header = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    writeUint32LE(view, 0, 0x02014b50);
    writeUint16LE(view, 4, 20);
    writeUint16LE(view, 6, 20);
    writeUint16LE(view, 8, 0);
    writeUint16LE(view, 10, 0);
    writeUint16LE(view, 12, 0);
    writeUint16LE(view, 14, 0);
    writeUint32LE(view, 16, entry.crc);
    writeUint32LE(view, 20, entry.data.length);
    writeUint32LE(view, 24, entry.data.length);
    writeUint16LE(view, 28, entry.nameBytes.length);
    writeUint16LE(view, 30, 0);
    writeUint16LE(view, 32, 0);
    writeUint16LE(view, 34, 0);
    writeUint16LE(view, 36, 0);
    writeUint32LE(view, 38, 0);
    writeUint32LE(view, 42, offsets[index] ?? 0);
    header.set(entry.nameBytes, 46);
    centralParts.push(header);
    centralSize += header.length;
  });

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeUint32LE(eocdView, 0, 0x06054b50);
  writeUint16LE(eocdView, 4, 0);
  writeUint16LE(eocdView, 6, 0);
  writeUint16LE(eocdView, 8, encoded.length);
  writeUint16LE(eocdView, 10, encoded.length);
  writeUint32LE(eocdView, 12, centralSize);
  writeUint32LE(eocdView, 16, cursor);
  writeUint16LE(eocdView, 20, 0);

  const total = cursor + centralSize + eocd.length;
  const result = new Uint8Array(total);
  let position = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    result.set(part, position);
    position += part.length;
  }
  return result;
}

export function readZip(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22) throw new Error('zipInvalid');
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('zipInvalid');
  const eocdView = new DataView(bytes.buffer, bytes.byteOffset + eocdOffset, 22);
  const entryCount = eocdView.getUint16(10, true);
  const centralOffset = eocdView.getUint32(16, true);

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let cursor = centralOffset;
  for (let i = 0; i < entryCount; i += 1) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + cursor, 46);
    if (view.getUint32(0, true) !== 0x02014b50) throw new Error('zipInvalid');
    const method = view.getUint16(10, true);
    if (method !== 0) throw new Error('zipUnsupported');
    const compressedSize = view.getUint32(20, true);
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    const localHeaderOffset = view.getUint32(42, true);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decoder.decode(nameBytes);

    const localView = new DataView(bytes.buffer, bytes.byteOffset + localHeaderOffset, 30);
    if (localView.getUint32(0, true) !== 0x04034b50) throw new Error('zipInvalid');
    const localNameLength = localView.getUint16(26, true);
    const localExtraLength = localView.getUint16(28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    entries.push({ name, data });

    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
