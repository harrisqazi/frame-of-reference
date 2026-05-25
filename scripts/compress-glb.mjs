/**
 * Compress 3d-logo.glb for web + GitHub (<100MB).
 * Run: node scripts/compress-glb.mjs
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "public/models/3d-logo.glb");
const output = path.join(root, "public/models/3d-logo-compressed.glb");

if (!fs.existsSync(input)) {
  console.error("Missing:", input);
  process.exit(1);
}

const sizeMB = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

console.log("Input:", sizeMB(fs.statSync(input).size));

execSync(
  `npx --yes @gltf-transform/cli optimize "${input}" "${output}" --compress draco --texture-compress webp`,
  { stdio: "inherit", cwd: root }
);

const outSize = fs.statSync(output).size;
console.log("Output:", sizeMB(outSize));

if (outSize > 95 * 1024 * 1024) {
  console.warn("Still over ~95MB — GitHub may reject. Re-export with fewer textures/polygons.");
  process.exit(1);
}

fs.copyFileSync(output, path.join(root, "public/models/3d-logo.glb"));
console.log("Replaced public/models/3d-logo.glb");
