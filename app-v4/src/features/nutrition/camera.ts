interface DetectedBarcode {
  rawValue: string;
}
interface Detector {
  detect(source: unknown): Promise<DetectedBarcode[]>;
}
interface DetectorConstructor {
  new (options: { formats: string[] }): Detector;
}
type StopCamera = () => void;

export function barcodeCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices !== undefined &&
    'getUserMedia' in navigator.mediaDevices &&
    'BarcodeDetector' in globalThis
  );
}
export async function startBarcodeCamera(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<StopCamera> {
  if (!barcodeCameraSupported()) throw new Error('barcodeCameraUnsupported');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  const Constructor = (globalThis as typeof globalThis & { BarcodeDetector: DetectorConstructor })
    .BarcodeDetector;
  const detector = new Constructor({ formats: ['ean_8', 'ean_13', 'upc_a', 'upc_e', 'itf'] });
  let active = true;
  let frame = 0;
  const stop = () => {
    active = false;
    cancelAnimationFrame(frame);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };
  video.srcObject = stream;
  video.playsInline = true;
  await video.play();
  const scan = async () => {
    if (!active) return;
    try {
      const result = await detector.detect(video);
      const code = result[0]?.rawValue;
      if (code && /^\d{8,14}$/.test(code)) {
        stop();
        onCode(code);
        return;
      }
    } catch {
      /* A frame may be unavailable while camera starts. */
    }
    frame = requestAnimationFrame(() => void scan());
  };
  void scan();
  return stop;
}
