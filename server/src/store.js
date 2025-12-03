import { readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadSeedData } from './data.js';

const dataFile = resolve(process.cwd(), 'data', 'state.json');
let state = null;

const ensureFile = async () => {
  try {
    await access(dataFile, constants.F_OK);
  } catch {
    const seed = await loadSeedData();
    await writeFile(dataFile, JSON.stringify(seed, null, 2));
  }
};

export const getState = async () => {
  if (state) return state;
  await ensureFile();
  const raw = await readFile(dataFile, 'utf-8');
  state = JSON.parse(raw);
  return state;
};

const persist = async () => {
  if (!state) return;
  await writeFile(dataFile, JSON.stringify(state, null, 2));
};

export const createResource = async (payload) => {
  const current = await getState();
  const newResource = {
    id: `res-${randomUUID()}`,
    type: payload.type,
    label: payload.label,
    hostname: payload.hostname || payload.label.toLowerCase().replace(/\s+/g, '-') + '.local',
    provider: payload.provider,
    expiryDate: payload.expiryDate,
    status: 'healthy',
    renewalUrl: payload.renewalUrl || '',
    notes: payload.notes || '',
    lastChecked: new Date().toISOString(),
    tags: [],
  };
  current.resources.push(newResource);
  await persist();
  return newResource;
};
