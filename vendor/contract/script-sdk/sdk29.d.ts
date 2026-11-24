/** SDK29 adds immediately committed ordinary storage in declared datasets. */
import type {} from './sdk28.js';
import type { ScriptPersistentStore } from './types.js';

declare module './sdk17.js' {
  interface EleconContext {
    readonly storage?: { open(dataset: string): Required<ScriptPersistentStore> };
  }
}
