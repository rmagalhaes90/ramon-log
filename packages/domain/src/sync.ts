export function hasRevisionConflict(
  remoteUpdatedAt: unknown,
  baseUpdatedAt: string | undefined,
  remoteValue: unknown,
  localValue: unknown,
): remoteUpdatedAt is string {
  return (
    typeof remoteUpdatedAt === 'string' &&
    typeof baseUpdatedAt === 'string' &&
    remoteUpdatedAt > baseUpdatedAt &&
    JSON.stringify(remoteValue) !== JSON.stringify(localValue)
  );
}
