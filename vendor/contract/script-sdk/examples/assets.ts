import type {} from '../sdk28.js';

/** Scan model bytes in bounded chunks without retaining the entire file. */
export async function countNonzeroWeights(path: string): Promise<number> {
  const { size } = await elecon.assets.stat(path);
  const chunk = 1024 * 1024;
  let count = 0;
  for (let offset = 0; offset < size; offset += chunk) {
    const length = Math.min(chunk, size - offset);
    const bytes = await elecon.assets.readBytes(path, { offset, length });
    for (const weight of bytes) if (weight !== 0) count++;
  }
  return count;
}
