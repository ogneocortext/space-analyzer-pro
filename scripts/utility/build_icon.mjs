// Generates the Space Analyzer Pro app icon set from assets/icon/logo.svg.
// Renders crisp PNGs at standard sizes with sharp, then assembles a multi-size
// PNG-encoded .ico (no external tooling required). Run from repo root:
//   node scripts/utility/build_icon.mjs
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const iconDir = join(here, "..", "..", "assets", "icon");
const svg = readFileSync(join(iconDir, "logo.svg"));

const sizes = [16, 32, 48, 64, 128, 256];
const png = {};
for (const s of sizes) {
  const buf = await sharp(svg).resize(s, s).png().toBuffer();
  png[s] = buf;
  writeFileSync(join(iconDir, `icon-${s}.png`), buf);
  console.log(`wrote icon-${s}.png`);
}

const master = await sharp(svg).resize(512, 512).png().toBuffer();
writeFileSync(join(iconDir, "logo-512.png"), master);
console.log("wrote logo-512.png");

// Assemble a PNG-encoded ICO from the rendered sizes.
const word = (n) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const dword = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

const header = Buffer.concat([word(0), word(1), word(sizes.length)]);
let entries = Buffer.alloc(0);
let data = Buffer.alloc(0);
let offset = 6 + sizes.length * 16;
for (const s of sizes) {
  const dim = s >= 256 ? 0 : s;
  entries = Buffer.concat([
    entries,
    Buffer.from([dim, dim, 0, 0]), // width, height, color count, reserved
    word(1), // planes
    word(32), // bits per pixel
    dword(png[s].length),
    dword(offset),
  ]);
  data = Buffer.concat([data, png[s]]);
  offset += png[s].length;
}
writeFileSync(join(iconDir, "app-icon.ico"), Buffer.concat([header, entries, data]));
console.log("wrote app-icon.ico");
