import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const targets = ['dist'];

for (const target of targets) {
  const fullPath = resolve(root, target);
  try {
    await rm(fullPath, { recursive: true, force: true });
    console.log(`[resiar] removed ${target}`);
  } catch (error) {
    console.warn(`[resiar] could not remove ${target}: ${error?.message || error}`);
  }
}
