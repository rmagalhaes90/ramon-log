export type StopCamera = () => void;

export function barcodeCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices !== undefined &&
    'getUserMedia' in navigator.mediaDevices
  );
}

export async function startBarcodeCamera(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<StopCamera> {
  if (!barcodeCameraSupported()) throw new Error('barcodeCameraUnsupported');
  const { startZxingScanner } = await import('./camera-scanner');
  return startZxingScanner(video, onCode);
}
