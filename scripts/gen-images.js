/**
 * 生成占位图片（纯 Node，无第三方依赖）
 * 用法：node scripts/gen-images.js
 * 生成的图片会写入 images/ 目录。生产环境请用真实照片替换并上传到云存储。
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ---- 极简 PNG 编码器（RGB, 8bit） ----
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter: none
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---- 绘图辅助 ----
function hex(c) {
  return [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16)
  ];
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/** 竖向渐变 + 右上角高光圆，生成一张占位图 */
function makeCard(fromHex, toHex, accentHex) {
  const width = 400;
  const height = 300;
  const from = hex(fromHex);
  const to = hex(toHex);
  const accent = hex(accentHex);
  const rgb = Buffer.alloc(width * height * 3);
  const cx = width * 0.74;
  const cy = height * 0.3;
  const r = Math.min(width, height) * 0.26;

  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      let rr = lerp(from[0], to[0], t);
      let gg = lerp(from[1], to[1], t);
      let bb = lerp(from[2], to[2], t);

      // 右上角高光圆
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r) {
        const k = 1 - dist / r;
        rr = lerp(rr, accent[0], k * 0.55);
        gg = lerp(gg, accent[1], k * 0.55);
        bb = lerp(bb, accent[2], k * 0.55);
      }

      const idx = (y * width + x) * 3;
      rgb[idx] = rr;
      rgb[idx + 1] = gg;
      rgb[idx + 2] = bb;
    }
  }
  return encodePNG(width, height, rgb);
}

/** 默认头像：暖色底 + 简单人形 */
function makeAvatar() {
  const size = 240;
  const from = hex('#FFB39A');
  const to = hex('#FF8A5B');
  const rgb = Buffer.alloc(size * size * 3);
  const headCx = size / 2;
  const headCy = size * 0.38;
  const headR = size * 0.16;
  for (let y = 0; y < size; y += 1) {
    const t = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      let r = lerp(from[0], to[0], t);
      let g = lerp(from[1], to[1], t);
      let b = lerp(from[2], to[2], t);
      const head = Math.hypot(x - headCx, y - headCy) < headR;
      // 肩部椭圆
      const body = ((x - headCx) / (size * 0.34)) ** 2 + ((y - size * 0.86) / (size * 0.34)) ** 2 < 1;
      if (head || body) {
        r = 255; g = 255; b = 255;
      }
      const idx = (y * size + x) * 3;
      rgb[idx] = r;
      rgb[idx + 1] = g;
      rgb[idx + 2] = b;
    }
  }
  return encodePNG(size, size, rgb);
}

function write(rel, buffer) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  console.log('generated', rel, `(${buffer.length} bytes)`);
}

const DISHES = {
  hot: ['#FF7043', '#FF9A6B', '#FFD3BE'],
  meat: ['#D7503A', '#F08A6A', '#FFD0C1'],
  veggie: ['#2E9E6B', '#7CCB9A', '#D8F3E2'],
  staple: ['#E0A93B', '#F3C969', '#FBEBC2'],
  soup: ['#2F9E96', '#6FC9C2', '#D3F1EE']
};

const BABY = {
  breakfast: ['#F2A65A', '#F7C98B', '#FCE9CB'],
  lunch: ['#3AA889', '#7ECEB4', '#D6F1E6'],
  dinner: ['#C15A8B', '#E08CB0', '#F6D2E1'],
  snack: ['#EE7A7A', '#F5AFAF', '#FBDDDD'],
  custom: ['#5B7FB8', '#8FB0DA', '#D6E2F3']
};

Object.entries(DISHES).forEach(([name, colors]) => {
  write(`images/dishes/${name}.png`, makeCard(...colors));
});
Object.entries(BABY).forEach(([name, colors]) => {
  write(`images/babyfood/${name}.png`, makeCard(...colors));
});
write('images/default-avatar.png', makeAvatar());
