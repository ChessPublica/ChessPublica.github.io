#!/usr/bin/env node
/**
 * ChessPublica — Build script
 *
 * Outputs:
 *   dist/ChessPublica.min.js       ChessPublica bundle (no vendor deps)
 *   dist/ChessPublica.min.css      ChessPublica styles only
 *   dist/ChessPublica.all.min.js   Everything in one JS file
 *   dist/ChessPublica.all.min.css  Everything in one CSS file
 *
 * Usage:
 *   npm install
 *   npm run build
 */

import { execSync }                   from "child_process";
import { mkdirSync, writeFileSync,
         readFileSync, existsSync,
         unlinkSync }                 from "fs";
import path                           from "path";
import { fileURLToPath }              from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
mkdirSync(DIST, { recursive: true });

/* ── Vendor paths (installed by npm) ────────────────────────── */

const VENDOR_JS_PATHS = [
  "node_modules/jquery/dist/jquery.min.js",
  "node_modules/chess.js/chess.js",                                       // minified below
  "node_modules/@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.js",
];

const VENDOR_CSS_PATHS = [
  "node_modules/@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.css",
];

/* chess.js 0.12 ships without a separate .min.js — minify it inline */
function readVendorJs(relPath) {
  const full = path.join(ROOT, relPath);
  if (!existsSync(full)) throw new Error("Vendor file not found: " + relPath + "\nRun: npm install");
  return readFileSync(full, "utf8");
}

/* ── Main ────────────────────────────────────────────────────── */

async function main() {
  /* 1. Read vendor files */
  console.log("\n📦 Reading vendor files…");
  const vendorJsTexts  = VENDOR_JS_PATHS.map(p => { console.log("   " + p); return readVendorJs(p); });
  const vendorCssTexts = VENDOR_CSS_PATHS.map(p => { console.log("   " + p); return readVendorJs(p); });

  /* chess.js 0.12 is not minified — run it through esbuild to shrink it */
  const chessJsIdx = 1;
  if (!VENDOR_JS_PATHS[chessJsIdx].endsWith(".min.js")) {
    const tmp = path.join(DIST, "_chess.min.js");
    execSync(`npx esbuild "${path.join(ROOT, VENDOR_JS_PATHS[chessJsIdx])}" --minify --outfile="${tmp}"`,
      { cwd: ROOT, stdio: "inherit" });
    vendorJsTexts[chessJsIdx] = readFileSync(tmp, "utf8");
    unlinkSync(tmp);
  }

  /* 2. Bundle ChessPublica ES modules with esbuild */
  console.log("\n⚙️  Bundling ChessPublica…");
  const bundleOut = path.join(DIST, "_bundle.min.js");
  execSync(
    `npx esbuild assets/_bundle-entry.js --bundle --minify --format=iife --outfile="${bundleOut}"`,
    { cwd: ROOT, stdio: "inherit" },
  );

  /* 3. Minify ChessPublica.css */
  const cssOut = path.join(DIST, "ChessPublica.min.css");
  execSync(
    `npx esbuild assets/ChessPublica.css --minify --outfile="${cssOut}"`,
    { cwd: ROOT, stdio: "inherit" },
  );

  /* 4. Assemble dist files */
  const bundleJs = readFileSync(bundleOut, "utf8");
  const minCss   = readFileSync(cssOut,    "utf8");

  /* ChessPublica only (no vendors) */
  writeFileSync(path.join(DIST, "ChessPublica.min.js"), bundleJs);

  /* All-in-one JS: vendor JS + ChessPublica bundle */
  writeFileSync(
    path.join(DIST, "ChessPublica.all.min.js"),
    vendorJsTexts.join("\n") + "\n" + bundleJs,
  );

  /* All-in-one CSS: vendor CSS + ChessPublica CSS */
  writeFileSync(
    path.join(DIST, "ChessPublica.all.min.css"),
    vendorCssTexts.join("\n") + "\n" + minCss,
  );

  /* Clean up intermediate files */
  unlinkSync(bundleOut);

  /* 5. Report */
  const kb = f => (readFileSync(path.join(DIST, f)).length / 1024).toFixed(1) + " KB";
  console.log("\n✅ dist/ ready:");
  console.log(`   ChessPublica.min.js      ${kb("ChessPublica.min.js").padStart(8)}  (ChessPublica only — include vendor CDN links separately)`);
  console.log(`   ChessPublica.min.css     ${kb("ChessPublica.min.css").padStart(8)}  (ChessPublica styles only)`);
  console.log(`   ChessPublica.all.min.js  ${kb("ChessPublica.all.min.js").padStart(8)}  (jQuery + chess.js + chessboard.js + ChessPublica)`);
  console.log(`   ChessPublica.all.min.css ${kb("ChessPublica.all.min.css").padStart(8)}  (chessboard.css + ChessPublica styles)`);
  console.log(`
Usage — all-in-one (2 lines):
  <script src="dist/ChessPublica.all.min.js"></script>
  <link rel="stylesheet" href="dist/ChessPublica.all.min.css">

Usage — ChessPublica only (vendor CDN handled separately):
  <script src="dist/ChessPublica.min.js"></script>
  <link rel="stylesheet" href="dist/ChessPublica.min.css">
`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
