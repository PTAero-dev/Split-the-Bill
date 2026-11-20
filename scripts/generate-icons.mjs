import { Jimp } from 'jimp';
import path from 'node:path';

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node scripts/generate-icons.mjs <source-image-path>');
  process.exit(1);
}

const publicDir = path.resolve(process.cwd(), 'public');
const source = await Jimp.read(sourcePath);

const targets = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-512-maskable.png', size: 512 },
];

for (const target of targets) {
  const outPath = path.join(publicDir, target.name);
  await source.clone().resize({ w: target.size, h: target.size }).write(outPath);
  console.log(`Generated ${outPath} (${target.size}x${target.size})`);
}
