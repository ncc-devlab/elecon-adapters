/** Exact domain schema versions shared by current source-package tests. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const contractDir = fileURLToPath(new URL("../../../contract", import.meta.url));
interface RegistryEntry {
  emits: { schema: string; schemaVersion: string; previousVersions?: string[] };
  params?: { schema: string; schemaVersion: string; previousVersions?: string[] };
}
interface Contract {
  registry: Record<string, RegistryEntry>;
  schemaFor: (id: string, version?: string) => ValidateFunction | undefined;
}
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
export function loadContract(): Contract {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const registryRaw = readJson<{ capabilities: Record<string, RegistryEntry> }>(
    join(contractDir, "capability", "registry.json"),
  );

  // 把所有已落盘的域 schema 编进同一个 ajv，按 $id 索引
  const schemaDir = join(contractDir, "schema");
  for (const file of readdirSync(schemaDir)) {
    if (!file.endsWith(".schema.json")) continue;
    const schema = readJson<Record<string, unknown>>(join(schemaDir, file));
    const id = typeof schema.$id === "string" ? schema.$id : undefined;
    if (id && !ajv.getSchema(id)) {
      ajv.addSchema(schema);
    }
  }

  // ADR-048/055: previousVersions is explicit for both output and parameters,
  // never an inferred same-major range. Keep exact historical descriptors.
  const schemaVersions = new Map<string, ValidateFunction>();
  for (const [capability, entry] of Object.entries(registryRaw.capabilities)) {
    for (const descriptor of [entry.emits, entry.params]) {
      if (!descriptor) continue;
      const current = ajv.getSchema(descriptor.schema);
      if (current) schemaVersions.set(`${descriptor.schema}\0${descriptor.schemaVersion}`, current);
      for (const version of descriptor.previousVersions ?? []) {
        if (
          !/^[a-z][a-z0-9.]*$/.test(capability) ||
          !/^elecon\.[a-z][a-z0-9.]*$/.test(descriptor.schema) ||
          !/^\d+\.\d+$/.test(version)
        ) {
          throw new Error("invalid historical schema reference");
        }
        const historical = readJson<Record<string, unknown>>(
          join(
            contractDir,
            "schema-versions",
            descriptor.schema.slice("elecon.".length),
            `${version}.schema.json`,
          ),
        );
        if (historical.$id !== descriptor.schema) throw new Error("historical schema identity mismatch");
        const historicalAjv = new Ajv2020({ allErrors: true, strict: false });
        addFormats(historicalAjv);
        schemaVersions.set(`${descriptor.schema}\0${version}`, historicalAjv.compile(historical));
      }
    }
  }

  return {
    registry: registryRaw.capabilities,
    schemaFor: (id, version) =>
      version == null
        ? (ajv.getSchema(id) as ValidateFunction | undefined)
        : schemaVersions.get(`${id}\0${version}`),
  };
}
