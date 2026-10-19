import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, checksum]);
}
const distance = (x, y, ax, ay, bx, by) => {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
};
export async function generateIcons() {
  const directory = fileURLToPath(new URL('../public/', import.meta.url));
  await mkdir(directory, { recursive: true });
  for (const size of [180, 192, 512]) {
    const raw = Buffer.alloc(size * (size * 3 + 1));
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = x / size * 192, ny = y / size * 192;
      const ink = Math.min(distance(nx, ny, 73, 49, 73, 140), distance(nx, ny, 73, 49, 128, 71), distance(nx, ny, 128, 71, 73, 92)) < 4
        || Math.abs(Math.hypot((nx - 96) / 43, (ny - 145) / 11) - 1) < 0.16;
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      raw.set(ink ? [216, 239, 158] : [20, 63, 54], offset);
    }
    const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
    await writeFile(`${directory}/icon-${size}.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  }
}
await generateIcons();
