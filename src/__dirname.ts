import { dirname } from 'path';
import { fileURLToPath } from 'url';

export const _dirname = dirname(dirname(fileURLToPath(import.meta.url)));
