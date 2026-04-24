// Convert public/favicon.svg to a 1024×1024 PNG used as the source for tauri icon.
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const svgPath = resolve('public/favicon.svg');
const outPath = resolve('src-tauri/app-icon.png');

mkdirSync(dirname(outPath), { recursive: true });
const svg = readFileSync(svgPath);

const png = await sharp(svg, { density: 512 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

writeFileSync(outPath, png);
console.log('wrote', outPath, png.length, 'bytes');
