export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export type PhotoCandidate = Pick<File, 'name' | 'size' | 'type'>;

export function validatePhoto(candidate: PhotoCandidate): 'photoType' | 'photoSize' | null {
  if (!['image/jpeg', 'image/jpg'].includes(candidate.type.toLowerCase())) return 'photoType';
  if (candidate.size <= 0 || candidate.size > MAX_PHOTO_BYTES) return 'photoSize';
  return null;
}

export function photoFileName(id: string): string {
  return `${id}.jpg`;
}

export function comparisonReady(selectedIds: ReadonlySet<string>): boolean {
  return selectedIds.size === 2;
}
