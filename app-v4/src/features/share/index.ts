export interface SharePayload {
  title: string;
  text: string;
  files?: File[];
}

export async function shareOrFallback(payload: SharePayload): Promise<'shared' | 'copied'> {
  const data: ShareData = { title: payload.title, text: payload.text };
  if (payload.files?.length && navigator.canShare?.({ files: payload.files })) data.files = payload.files;
  if (navigator.share) {
    await navigator.share(data);
    return 'shared';
  }
  await navigator.clipboard.writeText(payload.text);
  return 'copied';
}
