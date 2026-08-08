import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import type { StopCamera } from './camera';

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.CODE_128,
]);

export async function startZxingScanner(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<StopCamera> {
  const reader = new BrowserMultiFormatReader(hints);
  const controls = await reader.decodeFromConstraints(
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    video,
    (result, error) => {
      if (result) {
        const code = result.getText();
        if (/^\d{8,14}$/.test(code)) {
          controls.stop();
          onCode(code);
        }
        return;
      }
      if (error && !(error instanceof NotFoundException)) {
        /* Transient per-frame decode misses are expected while scanning. */
      }
    },
  );
  return () => controls.stop();
}
