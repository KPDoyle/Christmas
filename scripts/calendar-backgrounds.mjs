import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const scenes = (await readdir('public/scenes')).filter(name => name.endsWith('.webp'));
for (const file of ['carol.webp', 'market.webp', 'inn.webp', ...scenes.map(name => join('scenes', name))]) {
  const source = join('public', file);
  const output = join('public/hd', file);
  const { width } = await sharp(source).metadata();
  await mkdir(dirname(output), { recursive: true });
  await sharp(source)
    .resize({ width: Math.max(width, 3840), kernel: 'lanczos3' })
    .sharpen({ sigma: 1 })
    .webp({ quality: 89, effort: 4 })
    .toFile(output);
}
