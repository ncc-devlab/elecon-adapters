/** Trusted school script SDK 1–27 (including ADR-113). Values include actual secrets.
 * SDK2 defaults namespace to stable scriptId; namespace is not an access grant.
 */
export interface CredentialAddress {
  /** SDK2: defaults to scriptId. @legacy/@preview1 are explicit migration sources. */
  namespace?: string;
}
export interface CredentialRecord {
  /** Stable qualified identity; legacy ids include schoolId even when their stored ref is bare. */
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: "token" | "cookie" | "header" | "query" | "password";
  scope: string[];
  expiresAt: number | null;
  expired: boolean;
}
export interface CredentialOptions extends CredentialAddress {
  type?: CredentialRecord["type"];
  /** Unix epoch milliseconds. Omit to preserve, null to clear. */
  expiresAt?: number | null;
  scope?: string[];
}
export interface ScriptResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly url: string;
  readonly headers: {
    get(name: string): string | null;
    getSetCookie(): string[];
    raw(): Record<string, string[]>;
  };
  /** UTF-8/ASCII and explicit Latin-1; other encodings reject with unsupported_encoding. */
  text(): Promise<string>;
  /** Raw bytes allow adapter-owned legacy encoding decoders. */
  bytes(): Promise<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
}
export interface ScriptBrowser {
  /** SDK23: visible foreground interaction. Closing returns to the script;
   * invocation revocation still throws. Page completion is not business proof.
   * Existing official-page network/platform limits apply; no APPTunnel. */
  interact?<T = unknown>(options: ScriptBrowserInteraction): Promise<ScriptBrowserInteractionResult<T>>;
  /** SDK 4: fixed host login overlay; closing/cancelling remains available. */
  setBusy(busy: boolean): Promise<void>;
  open(url: string): Promise<unknown>;
  /** SDK14: open one digest-authorized manifest.webContent page. Android only;
   * direct page networking and page scripts are blocked. Scripts use ctx.fetch
   * and content(); the document receives no native or credential bridge.
   * Generic evaluate/text/queryAll are unavailable in a web.content run. */
  openContent?(pageId: string): Promise<void>;
  /** SDK14 + webContent: fixed DOM commands, no source evaluation. Selector
   * <=1024 chars, text values <=65536 UTF8 bytes, queryAll limit 1–100. Events
   * require real user input; submit/click prevent submission and repeat clicks.
   * waitForEvent defaults to 60s (max 90s); true=input, false=timeout. */
  content?(operation: ScriptContentOperation): Promise<unknown>;
  evaluate(source: string | ((...args: unknown[]) => unknown), ...args: unknown[]): Promise<unknown>;
  text(selector: string): Promise<string | null>;
  exists(selector: string): Promise<boolean>;
  queryAll(selector: string, limit?: number): Promise<unknown[]>;
  waitFor(selector: string, timeout?: number): Promise<boolean>;
  cookies(url?: string): Promise<unknown[]>;
  /** Restore saved cookies for an explicitly allowed URL. */
  setCookies(url: string, cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expiresDate?: number;
    isSecure?: boolean;
    isHttpOnly?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
  }>): Promise<void>;
}
export interface ScriptBrowserInteraction {
  /** Omit to continue the current visible official document. */
  url?: string;
  title?: string;
  /** 1–16 exact origins admitted by the package; main frame only. */
  origins: string[];
  /** Function or function-expression source. No QuickJS closures. Once per document. */
  inject?: string | ((...args: any[]) => unknown);
  /** Read-only polling callback: null means waiting; {done:true,value} completes. */
  until?: string | ((...args: any[]) => unknown);
  /** Transient JSON, <=64KiB, passed to both callbacks. */
  args?: unknown[];
  /** Up to16 declared HTTPS URLs; snapshots returned only to the calling script. */
  cookieUrls?: string[];
  /** Default180000, 1–600000ms; at most4 interactions and600000ms total/run. */
  timeoutMs?: number;
  /** Default750, 250–5000ms. */
  pollIntervalMs?: number;
}
export interface ScriptBrowserInteractionResult<T = unknown> {
  status: 'completed' | 'closed' | 'timedOut';
  value: T | null;
  cookies: Array<{url: string; cookies: unknown[]}>;
}
export interface ScriptContext {
  /** SDK25 bound stores. Host owns identity, serialization, commit and capacity. */
  readonly storage?: { open(dataset: string): ScriptStore };
  readonly cache?: { open(dataset: string): ScriptCache };
  /** Shorten this standard result's TTL within the manifest limit. */
  readonly query?: { cache: { configure(options: {ttlSeconds: number}): Promise<void> } };
  /** SDK24: protected P-256 address, current school/Profile; namespace is not a sandbox.
   * binding includes the verified subject and intended service. A changed binding
   * replaces the key only through publicKey. Signatures are SHA-256/P1363 base64url. */
  readonly signing?: {
    publicKey(key: string, options: {namespace: string; binding: string}): Promise<{kty: "EC"; crv: "P-256"; x: string; y: string}>;
    sign(key: string, message: string, options: {namespace: string; binding: string}): Promise<string>;
  };
  /** SDK21, only when manifest.datasets is nonempty. Host-bound, versioned
   * private JSON; writes are staged until valid capability completion. */
  readonly data?: ScriptData;
  /** SDK20: remaining invocation/transport/process requests; observation, not reservation. */
  readonly budget?: { remaining(): Promise<{requests: number}> };
  /** SDK19: present only in a host-opened foreground query scope.
   * Registrations never retain JS closures or invocation params. */
  readonly execution?: ScriptExecution;
  /** SDK17: namespaced business failures; use ordinary throw/try/catch.
   * Local codes match [a-z][a-z0-9_]{0,63}; no messages or response text.
   * For execution globals and the supported Web API subset, see sdk17.d.ts. */
  readonly errors?: { create(localCode: string): Error & { readonly code: 'script_business_error'; readonly businessCode: string } };
  /** SDK14: declared account only, bound to this invocation and approved source.
   * Manual input is allowed only from the declared foreground login binding.
   * Choosing web fallback throws account_interactive_fallback; null is cancel.
   * Automatic attempts require an available declared silent presenter; currently
   * unavailable. Never replay a command after authentication recovery. */
  readonly accounts?: {
    password(accountId: string, options: { mode: "manual" | "automatic" }): Promise<{
      attemptId: string; username: string; password: string;
    } | null>;
    /** Report success only after a real service probe. New saved credentials are
     * published only after validation and protected storage succeeds. */
    completePassword(accountId: string, result: {
      attemptId: string; outcome: ScriptPasswordOutcome;
    }): Promise<void>;
    report(accountId: string, event: {
      status: "authenticated" | "signedOut" | "expired" | "unknown";
      reason: ScriptAccountReason;
    }): Promise<void>;
  };
  /** SDK13: canonical requested locale, independent of the host's translated UI languages. */
  readonly locale?: string;
  /** SDK13 + manifest.localization. Package-owned plain text; no network or evaluation. */
  readonly i18n?: {
    /** Selected package language after exact/script/language/default fallback. */
    readonly locale: string;
    readonly supportedLocales: readonly string[];
    /** Missing keys fall back to the package default. Unknown keys or missing,
     * extra or invalid values throw fixed errors. Supports {name} only, no ICU. */
    t(key: string, values?: Record<string, string | number>): string;
  };
  /** SDK 3+: fixed transient native form; no automatic persistence/retry. */
  readonly ui?: {
    requestInput(request: ScriptInputRequest): Promise<Record<string, string> | null>;
    /** SDK8 + manifest.scanner=true; foreground only. Cancel returns null.
     * QR text ≤4096 UTF-8 bytes; max 3 serial calls/run. No image, navigation,
     * persistence or check-in submission.
     */
    scanQRCode?(): Promise<{ text: string; format: "qrCode" } | null>;
    /** SDK10 + camera permission: explicit native photo capture, not liveness verification. */
    capturePhoto?(): Promise<ScriptImage | null>;
    /** SDK10 + image permission: one explicitly selected image, no directory/file access. */
    pickImage?(): Promise<ScriptImage | null>;
    /** SDK10 + location permission: one current foreground WGS84 observation. */
    getCurrentPosition?(): Promise<ScriptPosition | null>;
  };
  /** ADR-052: SDK9, separately declared websocketOrigins, foreground only.
   * One TLS connection/run, 30s lifetime, 64KiB/message, 1MiB and 128 frames
   * per direction. No compression, redirects, automatic auth or reconnect. */
  readonly websocket?: {
    open(url: string): Promise<void>;
    send(bytes: Uint8Array): Promise<void>;
    /** 1–5000ms, default 1000. Null means timeout, closure throws. */
    receive(timeoutMs?: number): Promise<Uint8Array | null>;
    close(): Promise<void>;
  };
  /** Current authorized school only; revoked sessions are unavailable.
   * SDK2 list retains every namespace; get(record.key,{namespace:record.namespace}) round-trips.
   * set/delete resolve after in-memory acceptance; the host awaits storage at run end.
   */
  readonly credentials: {
    /** SDK25 scoped address; this is not a new namespace permission sandbox. */
    open?(namespace?: string): ScriptCredentialObject;
    get(key: string, address?: CredentialAddress): Promise<CredentialRecord | null>;
    list(): Promise<CredentialRecord[]>;
    set(key: string, value: string, options?: CredentialOptions): Promise<void>;
    delete(key: string, address?: CredentialAddress): Promise<void>;
    /** SDK24: wait for protected persistence before an external side effect. */
    flush?(): Promise<void>;
  };
  fetch(url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    /** Uint8Array requires SDK10; total request body is bounded to 1MiB. */
    body?: string | Uint8Array;
    redirect?: "manual" | "follow" | "error";
  }): Promise<ScriptResponse>;
  /** Present only when browser=true; host platform limitations still apply. */
  readonly browser?: ScriptBrowser;
  /** SDK12 + manifest.appTunnels; host-owned credentials never returned. */
  readonly appTunnel?: {
    /** SDK22 returns accountId only from verified online_info identity.
     * Earlier SDKs keep display-only status. A named session verifier may
     * call status silently; login still requires explicit foreground input. */
    status(provider: "hermes-atrust"): Promise<ScriptAccountState>;
    /** Explicit account-page operation. Without options, open the host manager
     * and recheck after its identity transition. SDK15 accountId selects the
     * declared reuse target; authenticate and verify once before saving. */
    login(provider: "hermes-atrust", options?: {accountId: string}): Promise<ScriptAccountState>;
  };
  now(): number;
  log(level: "debug" | "info" | "warn" | "error", message: string): void;
}

export type ScriptStateValue = null | boolean | number | string | ScriptStateValue[] | { [key: string]: ScriptStateValue };
/** ADR-109: standard capability results are saved automatically according to
 * dataCache/home declarations. Use this API only for auxiliary private JSON.
 * Keys are logical names (1–128 ASCII letters/digits/._-), never file paths.
 * No cross-Profile, cross-school or arbitrary source selectors are accepted.
 * Each invocation reads its own staged changes. Successful validated output
 * commits all staged changes atomically; failure/cancellation discards them.
 * 64KiB/item, declared count/bytes/TTL, at most 128 changed keys per run
 * (including deleted/expired keys); no unbounded scans or SQL. */
export interface ScriptData {
  /** Return a fresh value or call load once per dataset/key within this run,
   * then stage it. A failed load is not saved. The callback stays ordinary JS;
   * it is never persisted or used to create a background task. */
  getOrLoad<T extends ScriptStateValue>(dataset: string, key: string, load: () => Promise<T>): Promise<T>;
  get(dataset: string, key: string): Promise<ScriptDataRecord | null>;
  set(dataset: string, key: string, value: ScriptStateValue): Promise<void>;
  delete(dataset: string, key: string): Promise<void>;
  /** Lexical key order, 1–64 entries (default 32). afterKey is exclusive. */
  list(dataset: string, options?: { prefix?: string; afterKey?: string; limit?: number }): Promise<ScriptDataRecord[]>;
}
export interface ScriptDataRecord {
  readonly key: string;
  readonly value: ScriptStateValue;
  /** Original host acquisition time, Unix milliseconds; staged new values use
   * the current invocation's staging time until committed. */
  readonly fetchedAt: number;
  readonly freshUntil: number | null;
}
/** ADR-097: scope memory, not credentials or persistent storage. */
export interface ScriptExecution {
  readonly stateKey: string | null;
  readonly trigger: 'initial' | 'manual' | 'timer';
  readonly state: {
    /** Missing keys throw execution_state_missing. Reads return JSON copies. */
    get(key: string): Promise<ScriptStateValue>;
    /** Plain JSON only; 64KiB/item, 32 items, 256KiB/scope, depth <=32. */
    set(key: string, value: ScriptStateValue): Promise<void>;
    delete(key: string): Promise<void>;
  };
  /** Names address the approved module's exported handlers. 16 registrations/scope.
   * State must already exist. Replacing a registration cancels its old timer. */
  register(registration: { id: string; handler: string; stateKey: string }): Promise<void>;
  unregister(id: string): Promise<void>;
  /** Unix milliseconds; 1s–24h ahead. One-shot, replaces this id's timer.
   * Over 30s late at execution start is missed. No background/restart recovery. */
  schedule(id: string, at: number): Promise<void>;
  /** Cancel only the appointment, retaining the registration and state. */
  cancel(id: string): Promise<void>;
}
/** Each registered entry gets a fresh ctx/engine and no business arguments.
 * Output must satisfy the owning capability's existing schema. */
export type ScriptHandlers = Record<string, (ctx: ScriptContext) => Promise<unknown>>;
/** ADR-037: 1–8 fields; request ≤32 KiB; up to 8 serial requests per run. */
export interface ScriptInputRequest {
  title: string;
  message?: string;
  fields: Array<{
    id: string;
    label: string;
    type?: "text" | "password" | "select";
    /** Defaults to true. */
    required?: boolean;
    /** Defaults to 128; maximum 4096 UTF-16 code units. */
    maxLength?: number;
    /** Forbidden for password. For select it must be one declared value. */
    initialValue?: string;
    /** Required for select, forbidden otherwise; 1–20 unique values. */
    options?: Array<{ label: string; value: string }>;
  }>;
}
export type CapabilityHandler = (ctx: ScriptContext, params: Record<string, unknown>) => Promise<unknown>;
export interface CapabilityModule {
  capabilities: Record<string, CapabilityHandler>;
}

/** ADR-038: optional SDK4 manifest.home entry. Host timestamps successful data.
 * Entries are unique by capability, at most 16; capability must be declared.
 * Cache identity includes selected school, installed digest and canonical params.
 */
export interface ScriptHomeEntry {
  capability: string;
  /** 30–86400 seconds; stale data may display for at most seven days. */
  ttlSeconds: number;
  /** Default query, at most 4096 encoded UTF-8 bytes. */
  params?: Record<string, unknown>;
  /** Defaults false. Background runs cannot present browser/input/storage UI. */
  preload?: boolean;
}

/** ADR-043 §3: optional SDK6+ manifest.cards entry (at most ten entries).
 * SDK12 permits repeated types with distinct ids; older SDKs require unique types.
 * Suggestions never override saved user layout. The host owns geometry,
 * rendering and stable card identity; this is not a runtime JS layout API.
 * Each type requires its corresponding standard capabilities. This does not
 * change manifest.home cache/preload policy or grant any additional access.
 */
export type ScriptCardEntry = { id?: string; title?: string; /** SDK18 same-package page binding. */ pageId?: string } & (
  | {
      type: "notice" | "schedule" | "grades" | "library";
      defaultVariant: "compact" | "regular" | "expanded";
    }
  | {
      type: "card" | "exam" | "classroom" | "energy" | "climate" | "generic" | "directory";
      defaultVariant: "regular";
    });

/** ADR-043 §2.2: optional SDK7 manifest presentation metadata.
 * homeTitle is single-line plain text, at most 80 Unicode code points, without
 * control/bidi characters. Omission uses the school name. Approved digest
 * covers this field; it does not execute code or change package.name.
 */
export interface ScriptHomePresentation {
  homeTitle?: string;
}

/** SDK13 optional manifest resource. Authors select any supported language(s),
 * independently of core UI languages. Entire content is covered by package digest.
 * Canonical language[-Script][-REGION] profile; default dictionary is complete,
 * other dictionaries may omit keys but cannot add keys or change placeholders.
 * Max 32 languages, 1024 keys each, 4096 code points/message, 256 KiB UTF-8 JSON.
 */
export interface ScriptLocalizationDeclaration {
  defaultLocale: string;
  messages: Record<string, Record<string, string>>;
}

/** SDK8 manifest permission; omitted/false denies scanning. Digest authorized. */
export interface ScriptScannerPermission { scanner?: boolean; }

/** ADR-047: card.qr uses elecon.card.qr 1.0. PNG imageBase64, issuedAt and
 * expiresAt are required; purpose is optional. Foreground display only; never
 * declare this capability in home. No balance or transactions prerequisite. */
export interface CardQr {
  imageBase64: string;
  issuedAt: string;
  expiresAt: string;
  purpose?: string;
}

/** ADR-050/114/121: faculty.search is a foreground public-directory query.
 * Outputs 1.0/1.1/1.2 retain exact version semantics; 1.2 allows inline photos
 * up to 512 KiB (1.1: 48 KiB) and the existing optional contact fields.
 * No new host API; result types are generated from contract/schema.
 * At least one nonblank query/researchArea; page starts at 1. */
export interface FacultySearchParams {
  query?: string;
  researchArea?: string;
  page?: number;
  /** 1–20, defaults to 10. */
  pageSize?: number;
}

/** ADR-048/054/089/108: schedule.week 1.4 retains timeSegments/weekPreviews and
 * complete termWeeks; optional breakSegments name school-local HH:mm rest
 * intervals; optional timeZone names the school IANA zone (missing is unknown).
 * Breaks do not imply classroom availability or prohibit courses.
 * queryableWeeks explicitly lists candidates for standard term/week reads;
 * missing/empty disables automatic previews, never a term completeness claim.
 * Missing previews/breaks are unknown. Versions 1.0–1.3 retain exact validation;
 * query params, SDK APIs and permissions are unchanged. */
export type ScheduleWeek = import("../generated/ts/schedule.week.js").ScheduleWeek;

/** SDK9: up to eight exact wss origins; omission denies WebSocket use.
 * HTTP/browser network.origins grants no socket access. Digest authorized. */
export interface ScriptWebsocketPermission { websocketOrigins?: string[]; }
/** ADR-052: these capabilities are foreground-only and forbidden in home. */
export interface ServiceSessionParams { operation?: "status" | "login" | "logout"; }
export type MessagesList = import("../generated/ts/messages.list.js").MessagesList;
/** ADR-061: foreground, account-bound chat; storage belongs to the host. */
/** ADR-098 / output 1.3: avatarImages contains bounded inline PNG/JPEG bytes, never remote URLs. */
export type MessagesConversations = import("../generated/ts/messages.conversations.js").MessagesConversations;
export type MessagesHistory = import("../generated/ts/messages.history.js").MessagesHistory;
export type MessagesImage = import("../generated/ts/messages.image.js").MessagesImage;
export type MessagesImageParams = import("../generated/ts/params.messages.image.js").ParamsMessagesImage;
export type MessagesOpen = import("../generated/ts/messages.open.js").MessagesOpen;
export type MessagesOpenParams = import("../generated/ts/params.messages.open.js").ParamsMessagesOpen;
export type MessagesSend = import("../generated/ts/messages.send.js").MessagesSend;
export type MessagesConversationsParams = import("../generated/ts/params.messages.conversations.js").ParamsMessagesConversations;
export type MessagesHistoryParams = import("../generated/ts/params.messages.history.js").ParamsMessagesHistory;
export type MessagesSendParams = import("../generated/ts/params.messages.send.js").ParamsMessagesSend;
export type AttendanceCheckin = import("../generated/ts/attendance.checkin.js").AttendanceCheckin;

/** ADR-058: explicit SDK10 manifest permissions; no implicit scanner extension. */
export interface ScriptDeviceInputPermissions { deviceInputs?: Array<"camera" | "image" | "location">; }
/** Re-encoded pixels without original filename/path/EXIF. At most 512KiB and 1280px per side.
 * Bytes are transient, never an authentication or liveness result. */
export interface ScriptImage { bytes: Uint8Array; mimeType: "image/png"; width: number; height: number; }
/** Current platform position; decimal degrees, accuracy in meters, UTC RFC3339.
 * Never substitute manual service coordinates for this observation. */
export interface ScriptPosition { latitude: number; longitude: number; accuracyMeters: number; capturedAt: string; coordinateSystem: "wgs84"; }
/** SDK device errors: device_input_unavailable / permission_denied / invalid_request /
 * invalid_result / busy / limit / timeout (all prefixed device_input_), invocation_cancelled.
 * ADR-059 configuration_required denotes missing explicit service configuration,
 * independent of authentication; not a fabricated empty business result. */

/** SDK22 capability requiredSessions references a local account/session. */
export interface ScriptRequiredSession { accountId: string; sessionId: string; }
/** Cross-package references supply both provider and approved digest; local refs omit both. */
export type ScriptSessionPrerequisite = ScriptRequiredSession &
  ({ packageId: string; digest: string } | { packageId?: never; digest?: never });
export interface ScriptAccountSessionDeclaration {
  id: string;
  /** Complete namespace/key addresses touched by BOTH handlers. */
  credentials: string[];
  verifyHandler: string;
  acquisition: {
    id: string;
    kind: "userInput" | "exchange";
    handler: string;
    /** exchange requires at least one explicitly bound source. */
    requires?: ScriptSessionPrerequisite[];
  };
}

/** SDK 11/12 manifest metadata (ADR-064/066); no additional runtime authority. */
export interface ScriptAccountRequirement {
  /** SDK22: named sessions. First session is the account's connect/status entry.
   * Host pre-resolves all prerequisites and holds their complete credential
   * lease before calling handlers. handlers return ScriptAccountState;
   * authenticated MUST include a server-verified accountId. No ctx.sessions
   * dynamic invocation exists. Silent preparation cannot use input/passwords. */
  sessions?: ScriptAccountSessionDeclaration[];
  id: string;
  name: string;
  instructions: string;
  capabilities: string[];
  /** SDK16: this account needs the named same-package tunnel before checking/login. */
  appTunnelAccountId?: string;
  /** SDK27: approved HTTPS origin to check before requiring the tunnel. */
  directProbeOrigin?: string;
  /** SDK16: fixed host-managed connection, never arbitrary script/native loading. */
  appTunnel?: ScriptAppTunnelAccount;
  login?: { capability: string; params?: Record<string, unknown> };
  /** SDK12, account.session with {account:id,operation:"status"}; no interaction. */
  status?: { capability: "account.session"; params: {account: string; operation: "status"} };
  /** SDK14; login is required. This namespace is an address, not isolation. */
  authentication?: {
    namespace: string;
    savedPassword: true;
    interactiveWeb: boolean;
    /** Unsupported until hidden browser network enforcement is implemented. */
    silentWeb: false;
  };
  /** SDK15: target login only; host passes the source password to this fixed
   * approved HTTPS gateway once and independently verifies the target session. */
  credentialReuse?: {
    sourceAccountId: string;
    service: "hermes-atrust";
    gatewayUrl: string;
    loginDomain: string;
  };
}

export interface ScriptAppTunnelAccount {
  service: "hermes-atrust";
  gatewayUrl: string;
  loginDomain: string;
  nodeCertificateSha256?: string;
  /** web requires empty loginDomain; it does not prove a CAS realm. */
  loginMode?: "password" | "web";
}
export interface ScriptSchool { id:string;name:string;type:{id:string;name:string}; }
export interface ScriptCapabilityTunnelRequirement { appTunnelAccountId?: string; directProbeOrigin?: string; }

export type ScriptPasswordOutcome = "authenticated" | "interactionRequired" | "credentialsRejected" | "accountDisabled" | "unknown";
export type ScriptAccountReason = "verified" | "signedOut" | "primaryExpired" | "interactionRequired" | "credentialsRejected" | "accountDisabled" | "recoveryBlocked" | "networkUnknown";

/** ADR-066: source-verified status; network failure is unknown, never expired. */
export type ScriptAccountState = import("../generated/ts/account.session.js").AccountSession;
export interface ScriptAppTunnelPermission { appTunnels?: ["hermes-atrust"]; }

/** SDK14; browser:true and web.content/1.0 required. At most 8 unique pages,
 * HTML <=256KiB each and <=512KiB total UTF-8. Resources are package-owned. */
export interface ScriptWebContent { id: string; title: string; html: string; }

export type ScriptContentOperation =
  | { operation: "setText" | "setHtml" | "setValue"; selector: string; value: string }
  | { operation: "setAttribute"; selector: string; attribute: string; value: string }
  | { operation: "setDisabled"; selector: string; value: boolean }
  | { operation: "getText" | "getValue" | "exists"; selector: string }
  | { operation: "queryAll"; selector: string; limit?: number }
  | { operation: "waitForEvent"; selector: string; event: "click" | "submit" | "change"; timeoutMs?: number };

/** ADR-082/083: query.controls@2.1 describes same-package, read-only query fields.
 * Kind is a host prefab; id/labels have school-defined meaning. At most 32 fields,
 * 200 options per select, 32 selections and 512 Unicode characters per value.
 * Metadata <=128KiB; current/filters <=32KiB UTF-8. Omit empty optional values;
 * false and zero are valid. Disabled and undeclared fields are never submitted.
 * The script revalidates final values; defaults/labels never grant authority.
 * A deferred field is an optional leaf without initialValue. Its dependencies
 * must be ordinary fields; disabled fields are not loaded. load contains 1–32
 * unique ids; current includes only their values and declared dependencies.
 * Return the full form, but only the requested fields are applied: preserve
 * id/kind/dependsOn, omit initialValue, remain optional and resolve deferred.
 * No follow-on loading or automatic retries. Existing unresolved selections
 * are retained until confirmed or explicitly cleared; optional empty fields
 * never block a base query. Old 2.0 packages receive no load/deferred fields.
 * Legacy query.controls@1.0 keeps parameter/initialEnd semantics separately. */
export type QueryControls = import("../generated/ts/query.controls.js").QueryControls;
export type QueryControlsParams = import("../generated/ts/params.query.controls.js").ParamsQueryControls;
export type QueryFilters = NonNullable<QueryControlsParams["current"]>;
export type QueryFilterValue = QueryFilters[string];
/** Query changes only on explicit submit. current/changed refresh dependent
 * metadata without submitting; preserve valid draft values and clear dependents.
 * timeRange is {start,end} in the field's required school IANA timeZone. */
export type GradesListParams = import("../generated/ts/params.grades.list.js").ParamsGradesList;
export type ClassroomAvailableParams = import("../generated/ts/params.classroom.available.js").ParamsClassroomAvailable;
/** 1.3 room capacities have distinct meanings; missing is unknown. coverage
 * refers to appliedFilters/query scope, never an implicit all-campus guarantee. */
export type ClassroomAvailable = import("../generated/ts/classroom.available.js").ClassroomAvailable;

/** ADR-084: read-only complete phone directory. Empty params; local search and
 * user-triggered system dialing belong to the host. No script launch API. */
export type PhoneDirectory = import("../generated/ts/directory.phones.js").DirectoryPhones;

/** SDK18/ADR-086: host-owned detail pages; declarations do not grant execution.
 * At most 32 pages, with unique ids; up to three requested tabs are shown.
 * A typed card can bind its matching template; generic cards can bind any page.
 */
export interface ScriptPageEntry {
  id: string;
  title: string;
  template: ScriptCardEntry["type"] | "faculty" | "forum" | "messages" | "web";
  tab?: boolean;
  /** Required only for web; references this package's webContent id. */
  webPageId?: string;
}

/** ADR-092: 1.1 lists saved local bindings independently of live status.
 * Only deviceId/label/commands are required; optional fields enable finite
 * supported controls. bindingVerifiedAt is historical, never online proof. */
export type ClimateDevices = import("../generated/ts/climate.devices.js").ClimateDevices;

/** ADR-099/108: optional sparse metadata, never a complete directory or send grant.
 * 1.1 fields selects text before avatars; lastMessageAt requires hasContent. */
export type MessagesEnrich = import("../generated/ts/messages.enrich.js").MessagesEnrich;
export type MessagesEnrichParams = import("../generated/ts/params.messages.enrich.js").ParamsMessagesEnrich;

/** ADR-107: optional same-source read-only plan, at most three candidates and
 * 16 KiB UTF-8. Validate an explicit building and preserve school conditions or
 * return no queries. Field widgets do not define cross-date reuse semantics.
 * The host supplies school today and checks dates/budgets; params are complete. */
export type QueryPrefetch = import("../generated/ts/query.prefetch.js").QueryPrefetch;
export type QueryPrefetchParams = import("../generated/ts/params.query.prefetch.js").ParamsQueryPrefetch;

/** SDK25. get returns null for absence; entry distinguishes a stored null. */
export interface ScriptStore {
  get(key: string): Promise<ScriptStateValue | null>;
  entry(key: string): Promise<ScriptDataRecord | null>;
  set(key: string, value: ScriptStateValue): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {prefix?: string; afterKey?: string; limit?: number}): Promise<ScriptDataRecord[]>;
}
export interface ScriptCache extends ScriptStore {
  set(key: string, value: ScriptStateValue, options?: {ttlSeconds: number}): Promise<void>;
  getOrLoad<T extends ScriptStateValue>(key: string, load: () => Promise<T>, options?: {ttlSeconds: number}): Promise<T>;
}
export interface ScriptCredentialObject {
  get(key: string): Promise<string | null>;
  entry(key: string): Promise<CredentialRecord | null>;
  getJSON(key: string): Promise<ScriptStateValue | null>;
  set(key: string, value: string, options?: Omit<CredentialOptions, 'namespace'>): Promise<void>;
  setJSON(key: string, value: ScriptStateValue, options?: Omit<CredentialOptions, 'namespace'>): Promise<void>;
  delete(key: string): Promise<void>;
  flush(): Promise<void>;
}
