/** Generate host classification sets and schema restrictions from one source. */
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);
const policy = JSON.parse(await readFile(new URL("contract/script-capabilities.json", root), "utf8"));
const path = new URL("contract/script-package.schema.json", root);
const schema = JSON.parse(await readFile(path, "utf8"));
const manifest = schema.properties.manifest.properties;
const ids = manifest.capabilities.items.oneOf.map((x) => x.properties.id.const).sort();
if (JSON.stringify(ids) !== JSON.stringify(Object.keys(policy).sort()))
  throw Error("Missing capability policy");
for (const row of Object.values(policy)) {
  if (
    Object.keys(row).sort().join(",") !==
      "cacheable,exclusive,foreground,jobTarget,retentionDays,shareable" ||
    ["cacheable", "exclusive", "foreground", "jobTarget", "shareable"].some(
      (k) => typeof row[k] !== "boolean",
    ) ||
    ![7, 180].includes(row.retentionDays) ||
    (row.foreground && row.cacheable) ||
    (row.jobTarget && !row.cacheable)
  )
    throw Error("Invalid capability policy");
}
let dart = "// Generated from contract/script-capabilities.json. Do not edit.\n";
for (const [name, field, negative] of [
  ["foregroundCommunityCapabilities", "foreground"],
  ["uncachedScriptCapabilities", "cacheable", true],
  ["exclusiveScriptCapabilities", "exclusive"],
  ["shareableScriptCapabilities", "shareable"],
  ["dataJobTargets", "jobTarget"],
]) {
  dart +=
    `const ${name} = <String>{\n` +
    ids
      .filter((id) => (negative ? !policy[id][field] : policy[id][field]))
      .map((id) => `  '${id}',\n`)
      .join("") +
    "};\n";
}
dart +=
  "const scriptRetentionDays = <String, int>{\n" +
  ids.map((id) => `  '${id}': ${policy[id].retentionDays},\n`).join("") +
  "};\n";
const target = new URL("client/lib/core/scripts/capability_policy.g.dart", root);
const denied = ids.filter((id) => !policy[id].cacheable);
for (const field of ["home", "dataCache"]) manifest[field].items.properties.capability.not = { enum: denied };
const encoded = JSON.stringify(schema, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== dart || (await readFile(path, "utf8")) !== encoded)
    throw Error("Stale capability policy");
} else {
  await writeFile(target, dart);
  await writeFile(path, encoded);
}
