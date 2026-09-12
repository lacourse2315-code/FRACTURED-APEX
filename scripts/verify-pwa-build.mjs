import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'dist/manifest.webmanifest',
  'dist/icons/apple-touch-icon.png',
  'dist/icons/icon-192.png',
  'dist/icons/icon-512.png',
];

for (const path of requiredFiles) {
  await access(path, constants.R_OK);
}

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));

if (
  manifest.display !== 'standalone' ||
  manifest.orientation !== 'landscape' ||
  manifest.start_url !== '/' ||
  manifest.scope !== '/'
) {
  throw new Error('Built PWA manifest does not match the PRD-02 iOS installation contract.');
}
