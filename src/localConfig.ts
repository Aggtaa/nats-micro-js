import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

import { _dirname } from './__dirname.js';

function findPackageJson(path: string = _dirname): Record<string, unknown> | undefined {
  const ppath = join(path, 'package.json');
  if (existsSync(ppath))
    return JSON.parse(readFileSync(ppath, 'utf8'));

  const dir = dirname(path);
  if (dir !== '')
    return findPackageJson(dir);

  return undefined;
}

const pjson = findPackageJson();

export const localConfig = {
  name: String(pjson?.name ?? 'nats-micro'),
  version: String(pjson?.version ?? '0.0.0'),
};
