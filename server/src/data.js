import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const candidatePaths = [
  process.env.SEED_DATA_PATH,
  resolve(process.cwd(), 'data', 'seed.json'),
  resolve(process.cwd(), '../frontend/public/data/seed.json'),
];

let cache = null;
let resolvedSeedPath = null;

const resolveSeedPath = async () => {
  if (resolvedSeedPath) return resolvedSeedPath;
  for (const path of candidatePaths) {
    if (!path) continue;
    try {
      await access(path);
      resolvedSeedPath = path;
      return resolvedSeedPath;
    } catch {
      // continue checking the next path
    }
  }
  throw new Error('Seed data file tidak ditemukan. Set SEED_DATA_PATH atau taruh data/seed.json.');
};

export const loadSeedData = async () => {
  if (cache) return cache;
  const seedPath = await resolveSeedPath();
  const raw = await readFile(seedPath, 'utf-8');
  cache = JSON.parse(raw);
  return cache;
};
