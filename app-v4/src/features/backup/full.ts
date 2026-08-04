import type { User } from 'firebase/auth';
import { downloadPhotoBytes, uploadPhoto } from '../../services/photo-storage';
import { photoFileName } from '../photos/model';
import { createBackup, parseBackup, restoreBackup } from './index';
import { createZip, readZip } from './zip';

const BACKUP_ENTRY_NAME = 'backup.json';
const PHOTO_PREFIX = 'photos/';

function photoEntryName(id: string): string {
  return `${PHOTO_PREFIX}${photoFileName(id)}`;
}

function photoIdFromEntryName(name: string): string | null {
  if (!name.startsWith(PHOTO_PREFIX) || !name.endsWith('.jpg')) return null;
  return name.slice(PHOTO_PREFIX.length, -'.jpg'.length);
}

export async function createFullBackup(user: User): Promise<Uint8Array> {
  const backup = await createBackup(user);
  const photoIds = (backup.data.photoIndex ?? []).map((photo) => photo.id);
  const photoEntries = await Promise.all(
    photoIds.map(async (id) => ({
      name: photoEntryName(id),
      data: await downloadPhotoBytes(user, id),
    })),
  );
  return createZip([
    { name: BACKUP_ENTRY_NAME, data: new TextEncoder().encode(JSON.stringify(backup)) },
    ...photoEntries,
  ]);
}

export async function restoreFullBackup(
  user: User,
  zip: Uint8Array,
): Promise<{ failedPhotos: number }> {
  const entries = readZip(zip);
  const backupEntry = entries.find((entry) => entry.name === BACKUP_ENTRY_NAME);
  if (!backupEntry) throw new Error('zipInvalid');
  const backup = parseBackup(new TextDecoder().decode(backupEntry.data));
  await restoreBackup(user, backup);

  const photoEntries = entries
    .map((entry) => ({ id: photoIdFromEntryName(entry.name), data: entry.data }))
    .filter((entry): entry is { id: string; data: Uint8Array } => entry.id !== null);
  const results = await Promise.allSettled(
    photoEntries.map(({ id, data }) =>
      uploadPhoto(
        user,
        id,
        new File([new Uint8Array(data)], photoFileName(id), { type: 'image/jpeg' }),
      ),
    ),
  );
  const failedPhotos = results.filter((result) => result.status === 'rejected').length;
  return { failedPhotos };
}
