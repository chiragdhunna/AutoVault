// Dependency-free icon materializer. Decodes scripts/icons.base64.json into
// public/icons/*.png so the build always has the icon set without committing
// binaries or requiring Python/Pillow. (scripts/make-icons.py can regenerate
// the base64 from scratch.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, 'icons.base64.json'), 'utf8'));
const outDir = join(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

for (const [name, b64] of Object.entries(data)) {
  writeFileSync(join(outDir, name), Buffer.from(b64, 'base64'));
  console.log('wrote', join('public/icons', name));
}
