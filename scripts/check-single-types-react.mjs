// Fails when pnpm-lock.yaml resolves more than one @types/react (or @types/react-dom) version for the same
// major. Two copies make pnpm's `.pnpm/node_modules` hoist pick one arbitrarily per install, so packages
// without their own @types/react peer (e.g. next) resolve a different copy than the app -> flaky TS2742
// ("inferred type cannot be named without a reference to ...@types/react") on the SAME commit.
// Usage: node scripts/check-single-types-react.mjs [path/to/pnpm-lock.yaml]
import { readFileSync } from "node:fs";

const lockPath = process.argv[2] ?? "pnpm-lock.yaml";
const lock = readFileSync(lockPath, "utf8");
const versions = new Map(); // "@types/react@19" -> Set of versions
for (const m of lock.matchAll(/^ {2}'?(@types\/react(?:-dom)?)@(\d+)\.(\d+\.\d+)'?:/gm)) {
  const key = `${m[1]}@${m[2]}`;
  (versions.get(key) ?? versions.set(key, new Set()).get(key)).add(`${m[2]}.${m[3]}`);
}
const dupes = [...versions].filter(([, set]) => set.size > 1);
if (dupes.length > 0) {
  for (const [key, set] of dupes) console.error(`FAIL: ${key}.x resolves to multiple versions: ${[...set].join(", ")}`);
  console.error("Align every workspace package's @types/react (and @types/react-dom) to one version.");
  process.exit(1);
}
console.log(`OK: one version per major -> ${[...versions].map(([k, s]) => `${k}=${[...s][0]}`).join(", ")}`);
