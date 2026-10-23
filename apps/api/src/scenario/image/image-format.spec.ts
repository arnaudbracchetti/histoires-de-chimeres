import { acceptedFormatOf } from './image-format.js';

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === 'string' ? Array.from(Buffer.from(part, 'latin1')) : part,
    ),
  );

describe('acceptedFormatOf', () => {
  it.each([
    ['un JPEG', bytes([0xff, 0xd8, 0xff, 0xe0]), 'jpeg'],
    ['un PNG', bytes([0x89], 'PNG\r\n\x1a\n'), 'png'],
    ['un WebP', bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '), 'webp'],
    ['un AVIF', bytes([0, 0, 0, 0x1c], 'ftypavif'), 'avif'],
    ['une séquence AVIF', bytes([0, 0, 0, 0x1c], 'ftypavis'), 'avif'],
    ['un GIF', bytes('GIF89a'), null],
    ['un HEIC', bytes([0, 0, 0, 0x18], 'ftypheic'), null],
    ['un SVG', bytes('<svg xmlns="http://www.w3.org/2000/svg">'), null],
    ['un fichier vide', bytes(), null],
  ])('reconnaît %s', (_, file, format) => {
    expect(acceptedFormatOf(file)).toBe(format);
  });
});
