import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { ASSET_LIMIT, ENTRY_LIMIT, FILE_LIMIT, METADATA_LIMIT, ZIP_LIMIT } from "./package-zip.js";

export function readBounded(path: string, limit: number, projectFile = false): Buffer {
  const fd = openSync(
    path,
    constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (projectFile ? (constants.O_NOFOLLOW ?? 0) : 0),
  );
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || (projectFile && stat.nlink !== 1) || stat.size > limit)
      throw new Error("script_input_size");
    const bytes = Buffer.alloc(stat.size);
    let received = 0;
    while (received < bytes.length) {
      const count = readSync(fd, bytes, received, bytes.length - received, null);
      if (!count) throw new Error("script_input_changed");
      received += count;
    }
    if (readSync(fd, Buffer.alloc(1), 0, 1, null)) throw new Error("script_input_changed");
    return bytes;
  } finally {
    closeSync(fd);
  }
}

export function utf8(bytes: Buffer): string {
  // Keep a leading U+FEFF as part of entry source. JSON.parse rejects a BOM in P.
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error("script_package_utf8_invalid");
  }
}
export function parseJson(bytes: Buffer, signedDescriptor = false) {
  const text = utf8(bytes);
  const parsed = JSON.parse(text);
  // JSON.parse validates syntax. Its last-key-wins semantics must never erase
  // an ambiguity from a signed manifest or an author's explicit file map.
  const scopes: (Set<string> | null)[] = [];
  const integer = /\s*-?(?:0|[1-9][0-9]*)\s*(?=[,}])/y;
  let rootKey = "";
  for (const match of text.matchAll(/"(?:\\[\s\S]|[^"\\])*"(\s*:)?|[{}[\]]/g)) {
    if (match[0] === "{" || match[0] === "[") {
      if (scopes.length >= 128) throw new Error("script_json_depth");
      scopes.push(match[0] === "{" ? new Set() : null);
    } else if (match[0] === "}" || match[0] === "]") {
      scopes.pop();
    } else if (match[1]) {
      const key = JSON.parse(match[0].slice(0, -match[1].length));
      const current = scopes[scopes.length - 1]!;
      if (current.has(key)) throw new Error("script_duplicate_json_key");
      current.add(key);
      if (scopes.length === 1) rootKey = key;
      if (
        signedDescriptor &&
        ((rootKey === "files" && scopes.length === 3 && key === "size") ||
          (rootKey === "manifest" && scopes.length === 2 && key === "sdkVersion"))
      ) {
        // A Dart double (e.g. 1e1) is not the protocol's integer token.
        integer.lastIndex = match.index! + match[0].length;
        if (!integer.test(text)) throw new Error("script_package_manifest_invalid");
      }
    }
  }
  return parsed;
}

export function logicalPath(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length <= 255 &&
    name
      .split("/")
      .every((part) => part.length > 0 && !/[^A-Za-z0-9._-]/.test(part) && part !== "." && part !== "..")
  );
}
function projectPath(root: string, file: string): string {
  const path = resolve(file);
  const rel = relative(root, path);
  if (!rel || rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel))
    throw new Error("script_path_outside_project");
  let current = root;
  for (const part of rel.split(sep)) {
    current = resolve(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error("script_input_link");
  }
  return path;
}

export function readProjectJson(root: string, path: string) {
  return parseJson(readBounded(projectPath(realpathSync(root), path), METADATA_LIMIT, true));
}

export function projectFiles(
  source: string,
  rootDir: string,
  entry: string | undefined,
  assetsPath?: string,
  excluded: readonly string[] = [],
) {
  const root = realpathSync(rootDir);
  const name = entry ?? relative(root, source).split(sep).join("/");
  if (!logicalPath(name)) throw new Error("script_asset_path");
  const map: unknown = assetsPath ? readProjectJson(root, assetsPath) : {};
  if (!map || typeof map !== "object" || Array.isArray(map) || Object.keys(map).length >= FILE_LIMIT)
    throw new Error("script_asset_map");
  const excludedPaths = new Set(
    excluded.flatMap((path) => (existsSync(path) ? [path, realpathSync(path)] : [path])),
  );
  const files = new Map<string, Buffer>();
  let total = 0;
  function add(path: string, input: string, limit: number) {
    if (!logicalPath(path) || files.has(path)) throw new Error("script_asset_path");
    const resolved = projectPath(root, input);
    if (excludedPaths.has(resolved)) throw new Error("script_package_output_is_input");
    const data = readBounded(resolved, Math.min(limit, ZIP_LIMIT - total), true);
    total += data.length;
    files.set(path, data);
  }
  add(name, source, ENTRY_LIMIT);
  for (const [logical, file] of Object.entries(map)) {
    if (typeof file !== "string" || isAbsolute(file) || file.split(/[\\/]/).includes(".."))
      throw new Error("script_asset_map");
    add(logical, resolve(root, file), ASSET_LIMIT);
  }
  return { entry: name, files };
}
