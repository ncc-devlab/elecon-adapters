/**
 * ADR-034 §2: deterministic source packaging and signed CLI output without evaluation.
 * Packages gain execution trust only after the client's installation dialog.
 */

import { randomBytes } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { capabilityPolicy } from "./capability-policy.js";
import { validateScriptLocalization } from "./localization.js";
import { validateScriptNetwork } from "./network.js";
import { developmentKeyPath, loadKey, signScript } from "./sign.js";
import { validateScriptWebContent } from "./web-content.js";

export const MAX_SCRIPT_PACKAGE_BYTES = 1024 * 1024;

export class ScriptPackageError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ScriptPackageError";
  }
}

const schemaPath = fileURLToPath(new URL("../../../contract/script-package.schema.json", import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const validateSigned = ajv.compile(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../../contract/signed-script-payload.schema.json", import.meta.url)),
      "utf8",
    ),
  ),
);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonical(record[key])]),
    );
  }
  return value;
}

/** Returns stable UTF-8 JSON; never creates a runtime or evaluates source. */
export function packageScript(
  manifest: unknown,
  source: unknown,
  publicKey?: { algorithm: "ed25519"; value: string },
): string {
  if (typeof source !== "string" || !source.trim() || source.includes("\0")) {
    throw new ScriptPackageError("script_package_source_invalid");
  }
  const candidate = publicKey ? { manifest, source, publicKey } : { manifest, source };
  if (!(publicKey ? validateSigned(candidate) : validate(candidate))) {
    // AJV errors can include source-controlled fields. Keep CLI diagnostics
    // stable instead of accidentally echoing embedded credentials or URLs.
    throw new ScriptPackageError("script_package_manifest_invalid");
  }
  const typed = manifest as {
    name: string;
    id: string;
    school?: { id: string; name: string; type: { id: string; name: string } };
    homeTitle?: string;
    websocketOrigins?: string[];
    network: { origins: string[]; ipAllow?: string[] };
    capabilities: Array<{
      id: string;
      schemaVersion?: string;
      directProbeOrigin?: string;
      appTunnelAccountId?: string;
      requiredSessions?: Array<{ accountId: string; sessionId: string }>;
      dataAccess?: string[];
    }>;
    home?: Array<{ capability: string; params?: Record<string, unknown> }>;
    dataCache?: Array<{ capability: string; ttlSeconds: number }>;
    datasets?: Array<{ id: string }>;
    dependencies?: Array<{
      packageId: string;
      publicKey: { algorithm: "ed25519"; value: string };
      minVersion: string;
      maxVersionExclusive: string;
    }>;
    sdkVersion: number;
    browser: boolean;
    appTunnels?: string[];
    localization?: unknown;
    webContent?: unknown;
    cards?: Array<{ type: string; defaultVariant: string; id?: string; title?: string; pageId?: string }>;
    pages?: Array<{ id: string; title: string; template: string; tab?: boolean; webPageId?: string }>;
    accounts?: Array<{
      id: string;
      name: string;
      instructions: string;
      sessions?: Array<{
        id: string;
        acquisition: {
          requires?: Array<{ packageId?: string; digest?: string; accountId: string; sessionId: string }>;
        };
      }>;
      capabilities: string[];
      login?: { capability: string; params?: Record<string, unknown> };
      status?: { capability: string; params?: Record<string, unknown> };
      authentication?: {
        namespace: string;
        savedPassword: true;
        interactiveWeb: boolean;
        silentWeb: false;
      };
      credentialReuse?: { sourceAccountId: string; service: string; gatewayUrl: string; loginDomain: string };
      appTunnel?: {
        service: string;
        gatewayUrl: string;
        loginDomain: string;
        nodeCertificateSha256?: string;
        loginMode?: "password" | "web";
      };
      directProbeOrigin?: string;
      appTunnelAccountId?: string;
    }>;
  };
  if (
    typed.name.includes("\0") ||
    typed.name.length > 160 ||
    (typed.homeTitle !== undefined && Array.from(typed.homeTitle).length > 80) ||
    new Set(typed.capabilities.map((capability) => capability.id)).size !== typed.capabilities.length
  ) {
    throw new ScriptPackageError("script_package_manifest_invalid");
  }
  const capabilityIds = new Set(typed.capabilities.map((capability) => capability.id));
  const sessions = new Map(
    (typed.accounts ?? []).flatMap((account) =>
      (account.sessions ?? []).map((session) => [String(`${account.id}/${session.id}`), session] as const),
    ),
  );
  if (
    (typed.accounts ?? []).some(
      (account) =>
        new Set((account.sessions ?? []).map((session) => session.id)).size !==
          (account.sessions ?? []).length ||
        ((account.sessions ?? []).length > 0 &&
          (!capabilityIds.has("account.session") || account.login?.capability !== "account.session")),
    ) ||
    typed.capabilities.some((capability) =>
      (capability.requiredSessions ?? []).some((ref) => !sessions.has(`${ref.accountId}/${ref.sessionId}`)),
    )
  ) {
    throw new ScriptPackageError("script_package_manifest_invalid");
  }
  const dependencies = typed.dependencies ?? [];
  const versionOrder = (a: string, b: string): number => {
    const aa = a.split(".").map(BigInt),
      bb = b.split(".").map(BigInt);
    for (let i = 0; i < 3; i++) {
      if (aa[i]! < bb[i]!) return -1;
      if (aa[i]! > bb[i]!) return 1;
    }
    return 0;
  };
  if (
    new Set(dependencies.map((d) => d.packageId)).size !== dependencies.length ||
    dependencies.some(
      (d) =>
        d.packageId === typed.id ||
        versionOrder(d.minVersion, d.maxVersionExclusive) >= 0 ||
        Buffer.from(d.publicKey.value, "base64").toString("base64") !== d.publicKey.value,
    )
  ) {
    throw new ScriptPackageError("script_package_dependency_invalid");
  }
  const visited = new Set<string>(),
    visiting = new Set<string>();
  const visitSession = (key: string): void => {
    if (visited.has(key)) return;
    const session = sessions.get(key);
    if (!session || visiting.has(key)) throw new ScriptPackageError("script_package_manifest_invalid");
    visiting.add(key);
    const dependencyKeys = new Set(
      (session.acquisition.requires ?? []).map(
        (dependency) =>
          `${dependency.packageId ?? "@self"}/${dependency.digest ?? "@self"}/${dependency.accountId}/${dependency.sessionId}`,
      ),
    );
    const owner = typed.accounts?.find((account) => key.startsWith(`${account.id}/`));
    if (owner?.appTunnelAccountId) {
      const route = typed.accounts?.find((account) => account.id === owner.appTunnelAccountId);
      const routeSession = route?.sessions?.[0];
      if (!route?.appTunnel || !routeSession) throw new ScriptPackageError("script_package_manifest_invalid");
      dependencyKeys.add(`@self/@self/${route.id}/${routeSession.id}`);
      visitSession(`${route.id}/${routeSession.id}`);
    }
    if (dependencyKeys.size > 8) throw new ScriptPackageError("script_package_manifest_invalid");
    for (const dependency of session.acquisition.requires ?? []) {
      if (dependency.packageId === typed.id) throw new ScriptPackageError("script_package_manifest_invalid");
      if (
        dependency.packageId &&
        !dependency.digest &&
        (typed.sdkVersion < 26 || !dependencies.some((d) => d.packageId === dependency.packageId))
      ) {
        throw new ScriptPackageError("script_package_dependency_invalid");
      }
      if (!dependency.packageId) visitSession(`${dependency.accountId}/${dependency.sessionId}`);
    }
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of sessions.keys()) visitSession(key);
  if (
    typed.sdkVersion < 21 &&
    typed.capabilities.some((item) => item.id === "query.prefetch" && item.schemaVersion === "2.0")
  ) {
    throw new ScriptPackageError("script_package_manifest_invalid");
  }
  if (
    new Set((typed.datasets ?? []).map((item) => item.id)).size !== (typed.datasets ?? []).length ||
    new Set((typed.dataCache ?? []).map((item) => item.capability)).size !== (typed.dataCache ?? []).length
  ) {
    throw new ScriptPackageError("script_package_manifest_invalid");
  }
  for (const capability of typed.capabilities) {
    if (capability.dataAccess?.some((id) => !typed.datasets?.some((dataset) => dataset.id === id)))
      throw new ScriptPackageError("script_package_manifest_invalid");
  }
  for (const policy of typed.dataCache ?? []) {
    const home = typed.home?.find((item) => item.capability === policy.capability) as
      | { ttlSeconds?: number }
      | undefined;
    if (
      !capabilityIds.has(policy.capability) ||
      capabilityPolicy[policy.capability]?.cacheable !== true ||
      (home && home.ttlSeconds !== policy.ttlSeconds)
    ) {
      throw new ScriptPackageError("script_package_manifest_invalid");
    }
  }
  if (typed.school && (!typed.school.name.trim() || !typed.school.type.name.trim()))
    throw new ScriptPackageError("script_package_manifest_invalid");
  for (const account of typed.accounts ?? []) {
    const tunnel = account.appTunnel;
    if (
      tunnel &&
      (typed.sdkVersion < 16 ||
        account.authentication ||
        account.login?.capability !== "account.session" ||
        !account.status ||
        typed.network.ipAllow !== undefined ||
        !typed.appTunnels?.includes(tunnel.service) ||
        new URL(tunnel.gatewayUrl).origin !== tunnel.gatewayUrl ||
        !typed.network.origins.some((o) => new URL(o).origin === tunnel.gatewayUrl) ||
        (tunnel.loginMode === "web" && (tunnel.loginDomain !== "" || account.credentialReuse)) ||
        (account.credentialReuse &&
          (account.credentialReuse.service !== tunnel.service ||
            account.credentialReuse.gatewayUrl !== tunnel.gatewayUrl ||
            account.credentialReuse.loginDomain !== tunnel.loginDomain)))
    ) {
      throw new ScriptPackageError("script_package_manifest_invalid");
    }
    if (account.directProbeOrigin && account.sessions?.length)
      throw new ScriptPackageError("script_package_manifest_invalid");
    if (account.appTunnelAccountId && (tunnel || account.credentialReuse))
      throw new ScriptPackageError("script_package_manifest_invalid");
  }
  for (const item of [...typed.capabilities, ...(typed.accounts ?? [])]) {
    if (
      item.directProbeOrigin &&
      (!item.appTunnelAccountId ||
        !typed.network.origins.some(
          (o) => new URL(o).protocol === "https:" && new URL(o).origin === item.directProbeOrigin,
        ))
    ) {
      throw new ScriptPackageError("script_package_manifest_invalid");
    }
    if (
      item.appTunnelAccountId &&
      (!typed.accounts?.some((a) => a.id === item.appTunnelAccountId && a.appTunnel) ||
        (typed.capabilities.includes(item) && item.id === "account.session"))
    )
      throw new ScriptPackageError("script_package_manifest_invalid");
  }
  for (const account of typed.accounts ?? []) {
    const reuse = account.credentialReuse;
    if (!reuse) continue;
    const source = typed.accounts?.find((a) => a.id === reuse.sourceAccountId);
    let gateway: URL;
    try {
      gateway = new URL(reuse.gatewayUrl);
    } catch {
      throw new ScriptPackageError("script_package_manifest_invalid");
    }
    if (
      typed.sdkVersion < 15 ||
      !source?.authentication ||
      source.id === account.id ||
      source.credentialReuse ||
      account.authentication ||
      account.login?.capability !== "account.session" ||
      !account.status ||
      typed.network.ipAllow !== undefined ||
      !typed.appTunnels?.includes(reuse.service) ||
      gateway.protocol !== "https:" ||
      gateway.username ||
      gateway.password ||
      gateway.origin !== reuse.gatewayUrl ||
      !typed.network.origins.some((origin) => new URL(origin).origin === gateway.origin)
    ) {
      throw new ScriptPackageError("script_package_manifest_invalid");
    }
  }
  if (typed.webContent !== undefined) {
    try {
      validateScriptWebContent(typed.webContent);
    } catch {
      throw new ScriptPackageError("script_package_web_content_invalid");
    }
  } else if (capabilityIds.has("web.content")) {
    throw new ScriptPackageError("script_package_web_content_invalid");
  }
  if (typed.localization !== undefined) {
    try {
      validateScriptLocalization(typed.localization);
    } catch {
      throw new ScriptPackageError("script_package_localization_invalid");
    }
  }
  if (
    typed.accounts &&
    (new Set(typed.accounts.map((account) => account.id)).size !== typed.accounts.length ||
      typed.accounts.some(
        (account) =>
          account.name.length > 160 ||
          account.instructions.length > 2048 ||
          (account.authentication &&
            (typed.sdkVersion < 14 ||
              !account.login ||
              account.authentication.namespace.includes("\n") ||
              (account.authentication.interactiveWeb && !typed.browser) ||
              account.authentication.silentWeb !== false)) ||
          (account.login && !capabilityIds.has(account.login.capability)) ||
          (account.login?.capability === "account.session" &&
            (account.login.params?.account !== account.id ||
              account.login.params?.operation !== "login" ||
              Object.keys(account.login.params ?? {}).length !== 2)) ||
          (account.status &&
            (account.status.capability !== "account.session" ||
              !capabilityIds.has(account.status.capability) ||
              account.status.params?.operation !== "status" ||
              account.status.params?.account !== account.id ||
              Object.keys(account.status.params ?? {}).length !== 2)) ||
          account.capabilities.some((id) => !capabilityIds.has(id)) ||
          Buffer.byteLength(JSON.stringify(account.login?.params ?? {}), "utf8") > 4096,
      ))
  ) {
    throw new ScriptPackageError("script_package_manifest_invalid");
  }
  if (typed.cards && new Set(typed.cards.map((card) => card.id ?? card.type)).size !== typed.cards.length)
    throw new ScriptPackageError("script_package_manifest_invalid");
  const requiredPages: Record<string, string[][]> = {
    notice: [["notice.list"]],
    schedule: [["schedule.week"]],
    grades: [["grades.list"]],
    card: [["card.balance"], ["card.transactions"], ["card.qr"]],
    library: [["library.loans"]],
    exam: [["exam.list"]],
    classroom: [["classroom.buildings", "classroom.available"]],
    energy: [["energy.meters", "energy.usage"]],
    climate: [["climate.devices", "climate.status"]],
    generic: [["generic.section"]],
    directory: [["directory.phones"]],
    faculty: [["faculty.search"]],
    forum: [["forum.session"]],
    messages: [["messages.conversations"], ["messages.list"]],
    web: [["web.content"]],
  };
  const pages = typed.pages ?? [];
  if (
    new Set(pages.map((page) => page.id)).size !== pages.length ||
    pages.some(
      (page) =>
        !requiredPages[page.template]?.some((ids) => ids.every((id) => capabilityIds.has(id))) ||
        (page.template === "web" &&
          !(typed.webContent as Array<{ id: string }> | undefined)?.some((web) => web.id === page.webPageId)),
    ) ||
    typed.cards?.some(
      (card) =>
        card.pageId !== undefined &&
        !pages.some(
          (page) => page.id === card.pageId && (card.type === "generic" || card.type === page.template),
        ),
    )
  ) {
    throw new ScriptPackageError("script_package_manifest_invalid");
  }
  // ADR-043 §3: the JSON schema checks card types, variants, uniqueness and
  // capability dependencies. Keep suggestions inside the approved manifest.
  // ADR-038 §1: semantic bounds mirror the client parser.
  if (
    typed.home &&
    (new Set(typed.home.map((entry) => entry.capability)).size !== typed.home.length ||
      typed.home.some(
        (entry) =>
          capabilityPolicy[entry.capability]?.cacheable !== true ||
          !typed.capabilities.some((cap) => cap.id === entry.capability) ||
          Buffer.byteLength(JSON.stringify(entry.params ?? {}), "utf8") > 4096,
      ))
  ) {
    throw new ScriptPackageError("script_package_manifest_invalid");
  }
  try {
    validateScriptNetwork(typed.network);
    validateScriptNetwork({
      origins: (typed.websocketOrigins ?? []).map((s) => s.replace(/^wss:/, "https:")),
      ...(typed.network.ipAllow ? { ipAllow: typed.network.ipAllow } : {}),
    });
  } catch (error) {
    throw new ScriptPackageError(error instanceof Error ? error.message : "script_package_network_invalid");
  }
  const encoded = `${JSON.stringify(canonical(candidate))}\n`;
  if (Buffer.byteLength(encoded, "utf8") > MAX_SCRIPT_PACKAGE_BYTES) {
    throw new ScriptPackageError("script_package_too_large");
  }
  return encoded;
}

function readBoundedUtf8(path: string): string {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(MAX_SCRIPT_PACKAGE_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const count = readSync(descriptor, buffer, size, buffer.length - size, null);
      if (count === 0) break;
      size += count;
    }
    if (size > MAX_SCRIPT_PACKAGE_BYTES) {
      throw new ScriptPackageError("script_package_input_too_large");
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
    } catch {
      throw new ScriptPackageError("script_package_utf8_invalid");
    }
  } finally {
    closeSync(descriptor);
  }
}

function argumentsFor(args: string[]): Map<string, string> {
  const allowed = new Set(["--manifest", "--source", "--out"]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    const equal = argument.indexOf("=");
    const key = equal < 0 ? argument : argument.slice(0, equal);
    const value = equal < 0 ? args[++index] : argument.slice(equal + 1);
    if (!allowed.has(key) || values.has(key) || !value || value.startsWith("--")) {
      throw new ScriptPackageError("script_package_usage");
    }
    values.set(key, value);
  }
  if (values.size !== allowed.size) throw new ScriptPackageError("script_package_usage");
  return values;
}

/** Validates before writing and atomically replaces the output on success. */
export function packageScriptFiles(args: string[]): void {
  const values = argumentsFor(args);
  // npm workspace scripts run with cwd=tools, but arguments are supplied from
  // the user's invocation directory. Direct CLI use keeps ordinary cwd rules,
  // even if it inherited INIT_CWD from some unrelated npm parent process.
  const callerDirectory =
    process.env.npm_lifecycle_event === "scripts:package" && process.env.INIT_CWD
      ? process.env.INIT_CWD
      : process.cwd();
  const manifestPath = resolve(callerDirectory, values.get("--manifest")!);
  const sourcePath = resolve(callerDirectory, values.get("--source")!);
  const output = resolve(callerDirectory, values.get("--out")!);
  if (output === manifestPath || output === sourcePath) {
    throw new ScriptPackageError("script_package_output_is_input");
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(readBoundedUtf8(manifestPath));
  } catch (error) {
    if (error instanceof ScriptPackageError) throw error;
    if (error instanceof SyntaxError) throw new ScriptPackageError("script_package_json_invalid");
    throw error;
  }
  const keyPath = developmentKeyPath(callerDirectory);
  if ([output, manifestPath, sourcePath].includes(keyPath))
    throw new ScriptPackageError("script_package_output_is_input");
  const encoded = signScript(
    manifest,
    readBoundedUtf8(sourcePath),
    loadKey(keyPath, !process.env.ELECON_SCRIPT_KEY),
  );
  const directory = dirname(output);
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `.elecon-script-${randomBytes(12).toString("hex")}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, encoded, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, output);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporary, { force: true });
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    packageScriptFiles(process.argv.slice(2));
    console.log("script_package_created");
  } catch (error) {
    console.error(error instanceof ScriptPackageError ? error.code : "script_package_io_failed");
    process.exitCode = 1;
  }
}
