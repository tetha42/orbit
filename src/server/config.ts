import { buildConfig } from './config/builder';
import type { SystemConfig } from './config/typesAndParsers';

export type { SystemConfig } from './config/typesAndParsers';
export { readSecret } from './config/typesAndParsers';

/**
 * Singleton authoritative system configuration instance.
 */
export const CONFIG: SystemConfig = buildConfig();
