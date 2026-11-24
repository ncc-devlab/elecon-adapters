/** ADR-130 single-volume ZIP32. All offsets and lengths are unsigned 32-bit values. */
import { deflateRawSync, inflateRawSync } from "node:zlib";

export const MiB = 1024 * 1024;
export const ZIP_LIMIT = 256 * MiB;
export const ASSET_LIMIT = 64 * MiB;
export const ENTRY_LIMIT = 32 * MiB;
export const METADATA_LIMIT = MiB;
export const FILE_LIMIT = 1024;

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function invalid(): never {
  throw new Error("script_package_corrupt");
}
const isBlob = (name: string) => /^blobs\/[0-9a-f]{64}$/.test(name);
type ZipEntry = { method: number; size: number; crc: number; compressed: Buffer };

export function writeZip(files: ReadonlyMap<string, Buffer>, compress = true): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  let directorySize = 0;
  for (const [name, bytes] of files) {
    const filename = Buffer.from(name, "ascii");
    const candidate = compress && isBlob(name) ? deflateRawSync(bytes) : bytes;
    const data = candidate.length < bytes.length ? candidate : bytes;
    const local = Buffer.alloc(30 + filename.length);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(data === bytes ? 0 : 8, 8);
    local.writeUInt16LE(33, 12); // 1980-01-01
    local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    filename.copy(local, 30);
    const record = Buffer.alloc(46 + filename.length);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE(20, 4);
    local.copy(record, 6, 4, 30);
    record.writeUInt32LE(offset, 42);
    filename.copy(record, 46);
    parts.push(local, data);
    central.push(record);
    directorySize += record.length;
    offset += local.length + data.length;
    if (offset + directorySize + 22 > ZIP_LIMIT) throw new Error("script_package_too_large");
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

/** Validate the complete index before allocating any decompressed content. */
export function zipIndex(zip: Buffer): ReadonlyMap<string, ZipEntry> {
  if (zip.length > ZIP_LIMIT || zip.length < 22) invalid();
  const end = zip.length - 22;
  const u16 = (offset: number) => zip.readUInt16LE(offset);
  const u32 = (offset: number) => zip.readUInt32LE(offset);
  const count = u16(end + 10);
  const start = u32(end + 16);
  if (
    u32(end) !== 0x06054b50 ||
    u32(end + 4) !== 0 ||
    u16(end + 8) !== count ||
    u16(end + 20) !== 0 ||
    count < 3 ||
    count > FILE_LIMIT + 2 ||
    start + u32(end + 12) !== end
  )
    invalid();
  const entries = new Map<string, ZipEntry>();
  const spans: [number, number][] = [];
  let cursor = start;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50) invalid();
    const nameLength = u16(cursor + 28);
    const local = u32(cursor + 42);
    const method = u16(cursor + 10);
    const flags = u16(cursor + 8);
    const crc = u32(cursor + 16);
    const compressedSize = u32(cursor + 20);
    const size = u32(cursor + 24);
    const attrs = u32(cursor + 38);
    const type = (attrs >>> 16) & 0xf000;
    if (
      cursor + 46 + nameLength > end ||
      local + 30 + nameLength > start ||
      u16(cursor + 30) !== 0 ||
      u16(cursor + 32) !== 0 ||
      u16(cursor + 34) !== 0 ||
      (flags !== 0 && flags !== 0x800) ||
      (method !== 0 && method !== 8) ||
      (type !== 0 && type !== 0x8000) ||
      (attrs & 0x18) !== 0 ||
      u16(cursor + 6) > 20 ||
      u32(local) !== 0x04034b50 ||
      u16(local + 28) !== 0 ||
      !zip.subarray(local + 4, local + 28).equals(zip.subarray(cursor + 6, cursor + 30))
    )
      invalid();
    const nameBytes = zip.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = nameBytes.toString("latin1");
    const dataStart = local + 30 + nameLength;
    const dataEnd = dataStart + compressedSize;
    if (
      !nameBytes.equals(zip.subarray(local + 30, dataStart)) ||
      dataEnd > start ||
      entries.has(name) ||
      (method === 0 && compressedSize !== size)
    )
      invalid();
    if (name === "package.json") {
      if (method !== 0 || size > METADATA_LIMIT) invalid();
    } else if (name === "signature.ed25519") {
      if (method !== 0 || size !== 64) invalid();
    } else if (!isBlob(name) || size > ASSET_LIMIT) invalid();
    entries.set(name, { method, crc, size, compressed: zip.subarray(dataStart, dataEnd) });
    spans.push([local, dataEnd]);
    cursor += 46 + nameLength;
  }
  let covered = 0;
  for (const [offset, limit] of spans.sort((a, b) => a[0] - b[0])) {
    if (offset !== covered) invalid();
    covered = limit;
  }
  if (
    cursor !== end ||
    covered !== start ||
    !entries.has("package.json") ||
    !entries.has("signature.ed25519")
  )
    invalid();
  return entries;
}

export function unzip(entry: ZipEntry | undefined, expectedSize?: number): Buffer {
  if (!entry || (expectedSize !== undefined && entry.size !== expectedSize)) invalid();
  let bytes = entry.compressed;
  if (entry.method === 8) {
    // info exposes zlib's consumed input count (trailing compressed data is forbidden).
    const result = inflateRawSync(bytes, {
      info: true,
      maxOutputLength: Math.max(1, entry.size),
    }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
    if (result.engine.bytesWritten !== bytes.length) invalid();
    bytes = result.buffer;
  }
  if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) invalid();
  return bytes;
}
