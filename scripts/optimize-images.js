/**
 * 压缩小程序本地图片，确保图片资源总量不超过微信代码质量检查的 200KB 建议值。
 * 用法：node scripts/optimize-images.js
 *
 * 菜品缩略图在 140rpx 卡片中展示，220px 长边已覆盖高像素密度屏幕所需尺寸。
 * macOS 自带的 sips 用于处理图片，不依赖第三方 npm 包。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IMAGE_ROOT = path.join(ROOT, 'images');
const PHOTO_MAX_EDGE = 220;
const PHOTO_QUALITY = 35;
const GRAPHIC_MAX_EDGE = 160;
const ASSET_BUDGET = 200 * 1024;
const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg']);
const IMAGE_EXTENSIONS = new Set([...PHOTO_EXTENSIONS, '.png']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function runSips(args) {
  const result = spawnSync('sips', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `sips 执行失败：${args.join(' ')}`);
  }
}

function pixelSize(file) {
  const result = spawnSync(
    'sips',
    ['-g', 'pixelWidth', '-g', 'pixelHeight', file],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `无法读取图片尺寸：${file}`);
  }
  const width = Number((result.stdout.match(/pixelWidth:\s*(\d+)/) || [])[1]);
  const height = Number((result.stdout.match(/pixelHeight:\s*(\d+)/) || [])[1]);
  if (!width || !height) throw new Error(`无法解析图片尺寸：${file}`);
  return { width, height };
}

if (process.platform !== 'darwin') {
  console.error('该脚本使用 macOS 自带的 sips；其他系统请用等价的图片压缩工具。');
  process.exit(1);
}

const files = walk(IMAGE_ROOT).filter((file) =>
  IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())
);

files.forEach((file) => {
  const extension = path.extname(file).toLowerCase();
  const { width, height } = pixelSize(file);
  const longestEdge = Math.max(width, height);

  if (PHOTO_EXTENSIONS.has(extension) && longestEdge > PHOTO_MAX_EDGE) {
    runSips([
      '-Z', String(PHOTO_MAX_EDGE),
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', String(PHOTO_QUALITY),
      file,
      '--out', file
    ]);
    console.log(`compressed ${path.relative(ROOT, file)} (${width}x${height})`);
    return;
  }

  if (extension === '.png' && path.basename(file) !== 'default-avatar.png' &&
      longestEdge > GRAPHIC_MAX_EDGE) {
    runSips([
      '-Z', String(GRAPHIC_MAX_EDGE),
      file,
      '--out', file
    ]);
    console.log(`resized ${path.relative(ROOT, file)} (${width}x${height})`);
  }
});

const stats = files.map((file) => ({ file, bytes: fs.statSync(file).size }));
const totalBytes = stats.reduce((sum, item) => sum + item.bytes, 0);
const largest = stats.reduce((max, item) => (item.bytes > max.bytes ? item : max));

console.log(
  `图片资源：${files.length} 张，共 ${(totalBytes / 1024).toFixed(1)}KB，` +
  `最大 ${(largest.bytes / 1024).toFixed(1)}KB（${path.relative(ROOT, largest.file)}）`
);

if (totalBytes > ASSET_BUDGET) {
  console.error(`图片资源仍超过 200KB：${(totalBytes / 1024).toFixed(1)}KB`);
  process.exit(1);
}
console.log('✅ 图片资源已控制在 200KB 以内');
