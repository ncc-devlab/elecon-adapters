/** SDK28 execution globals. This type-only entry extends the existing host declarations. */
import type {} from './sdk17.js';
import type { PackageAssets } from './types.js';

declare module './sdk17.js' {
  interface EleconContext {
    readonly assets: PackageAssets;
  }
}
