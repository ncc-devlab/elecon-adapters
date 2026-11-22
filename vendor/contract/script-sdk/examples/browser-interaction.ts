import type { ScriptContext } from '../types.js';

// SDK23, browser:true, network.origins:["https://campus.example.edu"].
// Page callbacks are source strings here because QuickJS has no DOM library.
export async function waitForSchoolVerification(ctx: ScriptContext) {
  if (!ctx.browser?.interact) throw new Error('browser_unavailable');
  const result = await ctx.browser.interact<{ receipt: string }>({
    url: 'https://campus.example.edu/challenge',
    origins: ['https://campus.example.edu'],
    args: ['elecon'],
    inject: '(clientName) => { document.documentElement.dataset.clientName = clientName; }',
    until: `() => {
      const receipt = document.querySelector('[data-verification-receipt]')?.dataset.verificationReceipt;
      return receipt ? {done:true,value:{receipt}} : null;
    }`,
    cookieUrls: ['https://campus.example.edu/api/session'],
  });
  // No persistence or submission: the caller must independently verify this
  // untrusted page value and scoped Cookie snapshot with its school service.
  return result.status === 'completed' ? result : null;
}
