import type { ScriptContext } from '../types.js';

// SDK21 manifest.datasets must declare campus-metadata/version 1 with a TTL.
// This synthetic loader can be replaced by ordinary school HTTP/parsing code.
export const capabilities = {
  'generic.section': async (ctx: ScriptContext) => {
    const metadata = await ctx.data!.getOrLoad('campus-metadata', 'campus', async () => ({
      title: '示例校区',
    })) as { title: string };
    // The host validates this standard result, then commits both it and the
    // staged private record. Throwing here discards the staged data writes.
    return { sectionId: 'campus', title: metadata.title };
  },
};
