/** ADR-127: software keys are first-class; external/hardware signatures are optional. */
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
  fstatSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_SCRIPT_PACKAGE_BYTES, packageScript } from "./package.js";

export const SIGNED_PACKAGE_LIMIT = 1500 * 1024;
export type PublisherKey = { algorithm: "ed25519"; value: string };
export const signingMessage = (payload: Uint8Array): Buffer =>
  Buffer.concat([
    Buffer.from("elecon.script-package/3:ed25519:sha256\0", "utf8"),
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
export function validatePayload(bytes: Buffer): {
  manifest: Record<string, unknown>;
  source: string;
  publicKey: PublisherKey;
} {
  if (bytes.length > MAX_SCRIPT_PACKAGE_BYTES) throw new Error("script_package_too_large");
  const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!payload || Object.keys(payload).sort().join() !== "manifest,publicKey,source")
    throw new Error("script_payload_format");
  publicObject(payload.publicKey);
  // Validate semantics, but never replace the signed bytes with this serialization.
  packageScript(payload.manifest, payload.source, payload.publicKey);
  return payload;
}
export function assembleSignedPackage(payload: Buffer, signature: Buffer): string {
  const data = validatePayload(payload);
  if (
    signature.length !== 64 ||
    !verify(null, signingMessage(payload), publicObject(data.publicKey), signature)
  )
    throw new Error("script_signature_invalid");
  const result =
    JSON.stringify({
      format: "elecon-script/3",
      payload: payload.toString("base64"),
      signature: signature.toString("base64"),
    }) + "\n";
  if (Buffer.byteLength(result) > SIGNED_PACKAGE_LIMIT) throw new Error("script_package_too_large");
  return result;
}
export function signScript(manifest: unknown, source: string, key: KeyObject): string {
  const payload = Buffer.from(packageScript(manifest, source, publisherKey(key)));
  return assembleSignedPackage(payload, sign(null, signingMessage(payload), key));
}
export function inspectSignedPackage(text: string) {
  if (Buffer.byteLength(text) > SIGNED_PACKAGE_LIMIT) throw new Error("script_package_too_large");
  const envelope = JSON.parse(text);
  if (
    !envelope ||
    Object.keys(envelope).sort().join() !== "format,payload,signature" ||
    envelope.format !== "elecon-script/3"
  )
    throw new Error("script_envelope_format");
  const payload = canonicalBase64(envelope.payload);
  assembleSignedPackage(payload, canonicalBase64(envelope.signature, 64));
  const data = validatePayload(payload);
  return {
    packageId: data.manifest.id,
    version: data.manifest.version,
    publicKey: data.publicKey,
    digest: createHash("sha256").update(payload).digest("hex"),
    fingerprint: createHash("sha256").update(canonicalBase64(data.publicKey.value, 32)).digest("hex"),
  };
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
function readBounded(path: string, limit = MAX_SCRIPT_PACKAGE_BYTES): Buffer {
  const fd = openSync(path, "r");
  try {
    if (!fstatSync(fd).isFile() || fstatSync(fd).size > limit) throw new Error("script_input_size");
    const bytes = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > limit) throw new Error("script_input_size");
    return bytes.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}
export function signingCli(args: string[]): object {
  const command = args[0];
  const shapes: Record<string, string[]> = {
    keygen: ["key", "out"],
    sign: ["manifest", "source", "key", "out"],
    prepare: ["manifest", "source", "public-key", "out", "message"],
    assemble: ["payload", "signature", "out"],
    inspect: ["package"],
  };
  if (!command || !shapes[command]) throw new Error("script_sign_usage");
  const cwd =
    process.env.npm_lifecycle_event === "scripts:sign" && process.env.INIT_CWD
      ? process.env.INIT_CWD
      : process.cwd();
  const options = new Map<string, string>();
  for (let i = 1; i < args.length; i += 2) {
    const name = args[i]?.slice(2),
      value = args[i + 1];
    if (
      !args[i]?.startsWith("--") ||
      !name ||
      !shapes[command]!.includes(name) ||
      options.has(name) ||
      !value ||
      value.startsWith("--")
    )
      throw new Error("script_sign_usage");
    options.set(name, resolve(cwd, value));
  }
  if (options.size !== shapes[command]!.length || new Set(options.values()).size !== options.size)
    throw new Error("script_sign_usage");
  const path = (name: string) => options.get(name)!;
  const json = (name: string) =>
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(readBounded(path(name))));
  if (command === "inspect")
    return inspectSignedPackage(readBounded(path("package"), SIGNED_PACKAGE_LIMIT).toString("utf8"));
  if (command === "keygen") {
    const key = generateKeyPairSync("ed25519").privateKey;
    writeExclusive(path("key"), key.export({ type: "pkcs8", format: "pem" }).toString());
    writeExclusive(path("out"), JSON.stringify(publisherKey(key), null, 2) + "\n");
    return { created: true, publicKey: publisherKey(key) };
  }
  if (command === "prepare" || command === "sign") {
    const manifest = json("manifest");
    const source = new TextDecoder("utf-8", { fatal: true }).decode(readBounded(path("source")));
    if (command === "prepare") {
      const key = json("public-key") as PublisherKey;
      publicObject(key);
      const payload = Buffer.from(packageScript(manifest, source, key));
      writeExclusive(path("out"), payload);
      writeExclusive(path("message"), signingMessage(payload));
      return { prepared: true };
    }
    const output = signScript(manifest, source, loadKey(path("key"), true));
    writeExclusive(path("out"), output);
    return inspectSignedPackage(output);
  }
  const output = assembleSignedPackage(readBounded(path("payload")), readBounded(path("signature"), 64));
  writeExclusive(path("out"), output);
  return inspectSignedPackage(output);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length === 2 || process.argv[2] === "--help") {
      process.stdout.write(`elecon-script/3 source signing (ADR-127)\n
sign --manifest manifest.json --source bundled.js --key publisher.pem --out signed.elecon.json
  Creates an unencrypted Ed25519 PKCS8 PEM key if missing; reuses it for future releases.
keygen --key publisher.pem --out public-key.json
inspect --package signed.elecon.json
prepare --manifest manifest.json --source bundled.js --public-key public-key.json --out payload.json --message message.bin
assemble --payload payload.json --signature signature.bin --out signed.elecon.json
  External signers sign the 71 bytes of message.bin directly with Ed25519 and return a raw 64-byte signature.
Output files are exclusive: existing files are never overwritten. Retain your private key.\n`);
    } else process.stdout.write(JSON.stringify(signingCli(process.argv.slice(2)), null, 2) + "\n");
  } catch (error) {
    const message =
      error instanceof Error && /^script_[a-z_]+$/.test(error.message) ? error.message : "script_sign_failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
