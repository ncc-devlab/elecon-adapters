import type {} from '../sdk29.js';

export async function rememberPreference(value: string) {
  const preferences = elecon.storage!.open('preferences');
  if (value.length) await preferences.save('example', value);
  else await preferences.remove('example');
}
