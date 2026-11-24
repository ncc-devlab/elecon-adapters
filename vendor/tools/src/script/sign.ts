/** ADR-130: software keys are first-class; external/hardware signatures are optional. */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
  randomBytes,
  sign,
  verify,
} from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ScriptPackageError, sortedJson, validateDescriptorSchema, validateManifest } from "./package.js";
import { logicalPath, parseJson, projectFiles, readBounded, readProjectJson, utf8 } from "./package-input.js";
import {
  ASSET_LIMIT,
  ENTRY_LIMIT,
  FILE_LIMIT,
  METADATA_LIMIT,
  unzip,
  writeZip,
  ZIP_LIMIT,
  zipIndex,
} from "./package-zip.js";

export type PublisherKey = { algorithm: "ed25519"; value: string };
export const signingMessage = (payload: Uint8Array): Buffer =>
  Buffer.concat([
    Buffer.from("elecon.script-package/4:ed25519:sha256\0", "utf8"),
    createHash("sha256").update(payload).digest(),
  ]);
export function canonicalBase64(value: unknown, size?: number): Buffer {
  if (typeof value !== "string") throw new Error("script_signature_encoding");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || (size !== undefined && bytes.length !== size))
    throw new Error("script_signature_encoding");
  return bytes;
}
export function publisherKey(key: KeyObject): PublisherKey {
  const pub = key.type === "private" ? createPublicKey(key) : key;
  if (pub.asymmetricKeyType !== "ed25519") throw new Error("script_key_algorithm");
  const jwk = pub.export({ format: "jwk" });
  return { algorithm: "ed25519", value: Buffer.from(jwk.x!, "base64url").toString("base64") };
}
function publicObject(key: PublisherKey): KeyObject {
  if (!key || Object.keys(key).sort().join() !== "algorithm,value" || key.algorithm !== "ed25519")
    throw new Error("script_key_algorithm");
  return createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: canonicalBase64(key.value, 32).toString("base64url") },
    format: "jwk",
  });
}
/** No overwriting, including symlinks/hardlinks. Private keys never appear in diagnostics. */
export function writeExclusive(path: string, bytes: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomBytes(12).toString("hex")}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, bytes);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    linkSync(temporary, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(temporary, { force: true });
  }
}
export function loadKey(path: string, generate: boolean): KeyObject {
  try {
    return createPrivateKey(readBounded(path, 16 * 1024));
  } catch (error) {
    if (!generate || (error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("script_private_key_invalid");
    const key = generateKeyPairSync("ed25519").privateKey;
    writeExclusive(path, key.export({ type: "pkcs8", format: "pem" }).toString());
    return key;
  }
}
/** Repository work uses the local daily key when present. New authors get their own publisher key. */
export function developmentKeyPath(directory: string): string {
  const daily = resolve(directory, ".elecon/keys/daily-test.pem");
  return process.env.ELECON_SCRIPT_KEY
    ? resolve(directory, process.env.ELECON_SCRIPT_KEY)
    : existsSync(daily)
      ? daily
      : resolve(directory, ".elecon/keys/publisher.pem");
}

type Descriptor = {
  format: "elecon-script/4";
  publicKey: PublisherKey;
  manifest: Record<string, unknown>;
  entry: string;
  files: { path: string; size: number; sha256: string }[];
};
export type PackageFiles = { entry: string; files: ReadonlyMap<string, Buffer> };
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export function parsePayload(bytes: Buffer): Descriptor {
  if (bytes.length > METADATA_LIMIT) throw new Error("script_package_too_large");
  const desc = parseJson(bytes, true) as Descriptor;
  if (!Array.isArray(desc?.files) || desc.files.length > FILE_LIMIT || !validateDescriptorSchema(desc))
    throw new ScriptPackageError("script_package_manifest_invalid");
  publicObject(desc.publicKey);
  validateManifest(desc.manifest);
  let total = 0;
  let previous = "";
  const sizes = new Map<string, number>();
  for (const file of desc.files) {
    total += file.size;
    if (
      !logicalPath(file.path) ||
      file.path <= previous ||
      total > ZIP_LIMIT ||
      (sizes.has(file.sha256) && sizes.get(file.sha256) !== file.size) ||
      (file.path === desc.entry && file.size > ENTRY_LIMIT)
    )
      throw new Error("script_package_files");
    previous = file.path;
    sizes.set(file.sha256, file.size);
  }
  if (!desc.files.some((file) => file.path === desc.entry)) throw new Error("script_package_entry_missing");
  if (desc.manifest.checkinPage !== undefined) {
    const page = desc.files.find((file) => file.path === desc.manifest.checkinPage);
    if (!page || page.path === desc.entry || page.size < 1 || page.size > 256 * 1024)
      throw new Error("script_package_checkin_page_invalid");
  }
  return desc;
}

function sourceText(bytes: Buffer) {
  const text = utf8(bytes);
  if (!text.trim() || text.includes("\0")) throw new ScriptPackageError("script_package_source_invalid");
  return text;
}

/** Freeze P, without treating JS text re-encoding or transport compression as source bytes. */
export function preparePackage(manifest: unknown, project: PackageFiles, publicKey: PublisherKey): Buffer {
  if (project.files.size > FILE_LIMIT) throw new Error("script_package_files");
  const entry = project.files.get(project.entry);
  if (!entry) throw new Error("script_package_entry_missing");
  if (entry.length > ENTRY_LIMIT) throw new Error("script_package_too_large");
  sourceText(entry);
  let total = 0;
  const files = [...project.files.keys()].sort().map((path) => {
    const bytes = project.files.get(path)!;
    total += bytes.length;
    if (bytes.length > ASSET_LIMIT || total > ZIP_LIMIT) throw new Error("script_package_too_large");
    return { path, size: bytes.length, sha256: hash(bytes) };
  });
  const key = { algorithm: publicKey.algorithm, value: publicKey.value };
  const payload = Buffer.from(
    `{"format":"elecon-script/4","publicKey":${JSON.stringify(key)},"manifest":${sortedJson(manifest)},` +
      `"entry":${JSON.stringify(project.entry)},"files":${JSON.stringify(files)}}`,
  );
  parsePayload(payload);
  return payload;
}

function verifySignature(payload: Buffer, key: PublisherKey, signature: Buffer) {
  if (signature.length !== 64 || !verify(null, signingMessage(payload), publicObject(key), signature))
    throw new Error("script_signature_invalid");
}

export function assembleSignedPackage(payload: Buffer, signature: Buffer, project: PackageFiles): Buffer {
  const desc = parsePayload(payload);
  verifySignature(payload, desc.publicKey, signature);
  if (desc.files.length !== project.files.size || project.entry !== desc.entry)
    throw new Error("script_package_files");
  const physical = new Map([
    ["package.json", payload],
    ["signature.ed25519", signature],
  ]);
  for (const { path, size, sha256 } of desc.files) {
    const bytes = project.files.get(path);
    if (!bytes || bytes.length !== size || hash(bytes) !== sha256) throw new Error("script_package_corrupt");
    if (path === desc.entry) sourceText(bytes);
    physical.set("blobs/" + sha256, bytes);
  }
  return writeZip(physical);
}
export function signPrepared(manifest: unknown, project: PackageFiles, key: KeyObject): Buffer {
  const payload = preparePackage(manifest, project, publisherKey(key));
  return assembleSignedPackage(payload, sign(null, signingMessage(payload), key), project);
}
export function signScript(
  manifest: unknown,
  source: string,
  key: KeyObject,
  entry = "dist/adapter.mjs",
): Buffer {
  return signPrepared(manifest, { entry, files: new Map([[entry, Buffer.from(source)]]) }, key);
}
export function verifyPackage(bytes: Buffer) {
  const index = zipIndex(bytes);
  const payload = unzip(index.get("package.json"));
  const signature = unzip(index.get("signature.ed25519"), 64);
  const desc = parsePayload(payload);
  verifySignature(payload, desc.publicKey, signature);
  const unique = new Map(desc.files.map((f) => [f.sha256, f.size]));
  if (index.size !== unique.size + 2) throw new Error("script_package_files");
  const entryDigest = desc.files.find((f) => f.path === desc.entry)!.sha256;
  let source = "";
  for (const [digest, size] of unique) {
    const content = unzip(index.get("blobs/" + digest), size);
    if (hash(content) !== digest) throw new Error("script_package_corrupt");
    if (digest === entryDigest) source = sourceText(content);
  }
  return { desc, payload, signature, source };
}
export function inspectSignedPackage(bytes: Buffer) {
  const { desc, payload } = verifyPackage(bytes);
  return {
    packageId: desc.manifest.id,
    version: desc.manifest.version,
    publicKey: desc.publicKey,
    fingerprint: hash(canonicalBase64(desc.publicKey.value, 32)),
    digest: hash(payload),
    entry: desc.entry,
    files: desc.files,
  };
}

export function signingCli(args: string[]): object {
  const command = args[0];
  const required: Record<string, string[]> = {
    keygen: ["key", "out"],
    sign: ["manifest", "source", "key", "out"],
    prepare: ["manifest", "source", "public-key", "out", "message"],
    assemble: ["payload", "signature", "source", "out"],
    inspect: ["package"],
  };
  if (!command || !Object.hasOwn(required, command)) throw new Error("script_sign_usage");
  const cwd =
    process.env.npm_lifecycle_event === "scripts:sign" && process.env.INIT_CWD
      ? process.env.INIT_CWD
      : process.cwd();
  const allowed = new Set(required[command]);
  if (["sign", "prepare", "assemble"].includes(command)) {
    allowed.add("root");
    allowed.add("assets");
    if (command !== "assemble") allowed.add("entry");
  }
  const options = new Map<string, string>();
  for (let i = 1; i < args.length; i += 2) {
    const name = args[i]?.slice(2);
    const value = args[i + 1];
    if (
      !args[i]?.startsWith("--") ||
      !name ||
      !allowed.has(name) ||
      options.has(name) ||
      !value ||
      value.startsWith("--")
    )
      throw new Error("script_sign_usage");
    options.set(name, name === "entry" ? value : resolve(cwd, value));
  }
  if (required[command]!.some((k) => !options.has(k))) throw new Error("script_sign_usage");
  const io = [...options].filter(([k]) => k !== "root" && k !== "entry").map(([, v]) => v);
  if (new Set(io).size !== io.length) throw new Error("script_sign_usage");
  const path = (name: string) => options.get(name)!;
  if (command === "inspect") return inspectSignedPackage(readBounded(path("package"), ZIP_LIMIT));
  if (command === "keygen") {
    const key = generateKeyPairSync("ed25519").privateKey;
    writeExclusive(path("key"), key.export({ type: "pkcs8", format: "pem" }).toString());
    writeExclusive(path("out"), JSON.stringify(publisherKey(key), null, 2) + "\n");
    return { created: true, publicKey: publisherKey(key) };
  }
  const assembling = command === "assemble";
  const frozen = assembling ? readBounded(path("payload"), METADATA_LIMIT) : undefined;
  const root = options.get("root") ?? dirname(assembling ? path("source") : path("manifest"));
  const project = projectFiles(
    path("source"),
    root,
    frozen ? parsePayload(frozen).entry : options.get("entry"),
    options.get("assets"),
    ["key", "out", "message", "public-key", "signature", "payload", "manifest"]
      .filter((k) => options.has(k))
      .map(path),
  );
  let output: Buffer;
  if (frozen) {
    output = assembleSignedPackage(frozen, readBounded(path("signature"), 64), project);
  } else {
    const manifest = readProjectJson(root, path("manifest"));
    if (command === "prepare") {
      const key = parseJson(readBounded(path("public-key"), METADATA_LIMIT)) as PublisherKey;
      const payload = preparePackage(manifest, project, key);
      writeExclusive(path("out"), payload);
      writeExclusive(path("message"), signingMessage(payload));
      return { prepared: true, digest: hash(payload) };
    }
    output = signPrepared(manifest, project, loadKey(path("key"), true));
  }
  const info = inspectSignedPackage(output);
  writeExclusive(path("out"), output);
  return info;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length === 2 || process.argv[2] === "--help") {
      process.stdout.write(`elecon-script/4 (ADR-130)
sign --manifest manifest.json --source dist/adapter.mjs --key publisher.pem --out release.eleconpkg
keygen --key publisher.pem --out public-key.json
inspect --package release.eleconpkg
prepare --manifest manifest.json --source dist/adapter.mjs --public-key public-key.json --out package.json --message message.bin
assemble --payload package.json --signature signature.bin --source dist/adapter.mjs --out release.eleconpkg
sign and prepare accept --entry <logical path>. All build commands accept --root <directory> and
--assets <JSON file mapping logical paths to project-relative source files>. For assemble, use
the same project root and assets as prepare. External signers sign the 71-byte message.bin
with ordinary Ed25519 and return the raw 64-byte signature. Existing output files are preserved.\n`);
    } else process.stdout.write(JSON.stringify(signingCli(process.argv.slice(2)), null, 2) + "\n");
  } catch (error) {
    const message =
      error instanceof Error && /^script_[a-z0-9_]+$/.test(error.message)
        ? error.message
        : "script_sign_failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
