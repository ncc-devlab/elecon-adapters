/** Host policy, independent of school manifests. See ADR-116. */
import { readFileSync } from "node:fs";
export const capabilityPolicy: Record<
  string,
  {
    foreground: boolean;
    cacheable: boolean;
    exclusive: boolean;
    shareable: boolean;
    jobTarget: boolean;
    retentionDays: number;
  }
> = JSON.parse(readFileSync(new URL("../../../contract/script-capabilities.json", import.meta.url), "utf8"));
