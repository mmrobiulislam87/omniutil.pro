import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public/data/tac-osmocom.json");
const supplementPath = join(root, "public/data/tac-supplement.json");
const out = join(root, "public/data/tac-index.json");

const osmocom = JSON.parse(readFileSync(source, "utf8"));
const supplement = JSON.parse(readFileSync(supplementPath, "utf8"));

/** @type {Record<string, object>} */
const index = { ...supplement };

for (const [brand, brandData] of Object.entries(osmocom.brands ?? {})) {
  for (const modelEntry of brandData.models ?? []) {
    for (const [modelName, modelData] of Object.entries(modelEntry)) {
      const altNames = modelData.alt_names ?? [];
      const gsmarena = modelData.gsmarena ?? null;
      for (const tac of modelData.tacs ?? []) {
        if (!tac || index[tac]) continue;
        index[tac] = {
          brand,
          model: modelName,
          name: altNames[0] ?? modelName,
          altNames,
          gsmarena,
        };
      }
    }
  }
}

writeFileSync(out, JSON.stringify(index));

console.log(`Built tac-index.json with ${Object.keys(index).length} TAC entries`);
