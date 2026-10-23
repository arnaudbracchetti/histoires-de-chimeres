import { Injectable } from '@nestjs/common';
import type { ImageProcessor } from '@chimeres/application';
import sharp from 'sharp';
import { ImageRefusedError } from '../../http/image-refused.error.js';
import { acceptedFormatOf } from './image-format.js';

/** Au-delà, l'image est refusée avant d'être décodée en entier (PR-7). */
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_WIDTH = 1200;
const RATIO = 3 / 2;

/**
 * Traitement d'image par sharp, sans solution de secours (ADR 0007) : orientation EXIF appliquée,
 * recadrage 3:2 au centre, 1200 × 800 px au plus sans agrandir, WebP q80, sans métadonnées.
 */
@Injectable()
export class SharpImageProcessor implements ImageProcessor {
  async process(bytes: Uint8Array): Promise<Uint8Array> {
    if (!acceptedFormatOf(bytes)) throw new ImageRefusedError('image-format-unsupported');
    try {
      return await toWebp(bytes);
    } catch {
      throw new ImageRefusedError('image-unreadable');
    }
  }
}

async function toWebp(bytes: Uint8Array): Promise<Uint8Array> {
  const options = { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS } as const;
  const { width, height } = (await sharp(bytes, options).metadata()).autoOrient;
  const cropWidth = Math.min(width, Math.floor(height * RATIO));
  const cropHeight = Math.min(height, Math.floor(width / RATIO));
  // Les métadonnées tombent par défaut : sharp ne les recopie que sur demande.
  return sharp(bytes, { ...options, autoOrient: true })
    .extract({
      left: Math.floor((width - cropWidth) / 2),
      top: Math.floor((height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    })
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
