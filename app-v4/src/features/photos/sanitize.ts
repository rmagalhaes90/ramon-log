import { MAX_PHOTO_BYTES, validatePhoto } from './model';

const MAX_PHOTO_EDGE = 2560;

export function fittedPhotoSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodePhoto(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if ('createImageBitmap' in globalThis) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function sanitizePhoto(file: File): Promise<File> {
  const validation = validatePhoto(file);
  if (validation) throw new Error(validation);
  const decoded = await decodePhoto(file);
  try {
    const size = fittedPhotoSize(decoded.width, decoded.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('photoDecode');
    context.drawImage(decoded.source, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('photoEncode'))),
        'image/jpeg',
        0.86,
      ),
    );
    if (blob.size > MAX_PHOTO_BYTES) throw new Error('photoSize');
    return new File([blob], 'kyro-progress.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    decoded.close();
  }
}
