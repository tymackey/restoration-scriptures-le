"use strict";
/* eslint-env node */

/**
 * save-local-patches.js
 *
 * patch-package-style workflow for the vendored scripture XML source.
 *
 * The XML under scripts/0001_oc .. scripts/0007_cc is pulled wholesale from an
 * upstream source repo and periodically overwrites this tree entirely. Any
 * local-only edits (new files, small textual fixes) made directly in that
 * tree get clobbered by the next pull unless they're captured as patches.
 *
 * Workflow:
 *   1. After a fresh vendor pull, commit it, then tag it:
 *        git tag vendor-sync-YYYY-MM-DD
 *   2. Make local edits/additions directly in the scripts/000N_* dirs as needed.
 *   3. Run this script to snapshot those edits as patch files:
 *        node scripts/save-local-patches.js
 *   4. Commit scripts/local-patches/.
 *   5. Next time you pull fresh vendor files (which overwrite the tree) and
 *      tag the new baseline, run scripts/apply-local-patches.js to replay
 *      your saved patches on top.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const PATCHES_DIR = path.join(__dirname, "local-patches");

const VENDOR_DIRS = [
    "scripts/0001_oc",
    "scripts/0002_nc",
    "scripts/0003_nt",
    "scripts/0004_bofm",
    "scripts/0005_glossary",
    "scripts/0006_tc",
    "scripts/0007_cc",
];

function git(args) {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

function latestVendorSyncTag() {
    try {
        return git([
            "describe",
            "--tags",
            "--match",
            "vendor-sync-*",
            "--abbrev=0",
        ]).trim();
    } catch {
        throw new Error(
            "No vendor-sync-* tag found. Tag the last clean vendor pull first:\n" +
                "  git tag vendor-sync-YYYY-MM-DD",
        );
    }
}

function sanitize(relPath) {
    return relPath.replace(/\//g, "__") + ".patch";
}

function main() {
    const baseTag = latestVendorSyncTag();
    console.log(`Diffing against baseline tag: ${baseTag}`);

    // Changed/modified tracked files, plus untracked new files (e.g. new
    // appendix XML) within the vendored dirs.
    const changedTracked = git(["diff", "--name-only", baseTag, "--", ...VENDOR_DIRS])
        .split("\n")
        .filter(Boolean);
    const untracked = git([
        "ls-files",
        "--others",
        "--exclude-standard",
        "--",
        ...VENDOR_DIRS,
    ])
        .split("\n")
        .filter(Boolean);

    const changedPaths = Array.from(new Set([...changedTracked, ...untracked])).sort();

    if (changedPaths.length === 0) {
        console.log("No local changes found relative to baseline. Nothing to save.");
        return;
    }

    fs.mkdirSync(PATCHES_DIR, { recursive: true });

    // Clear stale patches so removed local edits don't leave orphaned files.
    for (const f of fs.readdirSync(PATCHES_DIR)) {
        if (f.endsWith(".patch")) fs.unlinkSync(path.join(PATCHES_DIR, f));
    }

    for (const relPath of changedPaths) {
        // --no-index-style full-file patch works for both modified and new
        // (untracked) files, and is what `git apply` can recreate cleanly
        // even after the vendor tree has been wholesale-replaced.
        git(["add", "-N", relPath]); // stage untracked files intent-to-add so diff includes them
        const patch = git(["diff", baseTag, "--", relPath]);
        if (!patch.trim()) continue;
        const outFile = path.join(PATCHES_DIR, sanitize(relPath));
        fs.writeFileSync(outFile, patch);
        console.log(`  saved ${path.relative(REPO_ROOT, outFile)}`);
    }

    console.log(`\nSaved ${changedPaths.length} patch(es) to scripts/local-patches/.`);
    console.log("Commit scripts/local-patches/ to keep them.");
}

main();
