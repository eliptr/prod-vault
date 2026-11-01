import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    len = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, sum]);
}
for (const size of [192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x - size * 0.52) / (size * 0.2),
        dy = (y - size * 0.43) / (size * 0.28);
      const leaf = dx * dx + dy * dy < 1 && x + y > size * 0.65;
      const stem =
        Math.abs(x - (size * 0.32 + (size * 0.7 - y) * 0.55)) < size * 0.014 &&
        y > size * 0.35 &&
        y < size * 0.75;
      const color = leaf || stem ? [239, 234, 209] : [85, 115, 99];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw.set([...color, 255], offset);
    }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8;
  head[9] = 6;
  writeFileSync(
    `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", head),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
