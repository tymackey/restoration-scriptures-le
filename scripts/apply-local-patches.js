"use strict";
/* eslint-env node */

/**
 * apply-local-patches.js
 *
 * Replays patches saved by save-local-patches.js on top of a freshly pulled
 * vendor tree. Run this after pulling new source XML and re-tagging the
 * baseline (git tag vendor-sync-YYYY-MM-DD), before running RebuildDatabase.js.
 *
 *   node scripts/apply-local-patches.js
 *
 * Patches that fail to apply mean the upstream pull touched the same lines
 * you patched. Those are reported (not applied) — open the .patch file,
 * re-apply the edit by hand against the new source, then re-run
 * save-local-patches.js to regenerate it.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const PATCHES_DIR = path.join(__dirname, "local-patches");

function git(args) {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

function main() {
    if (!fs.existsSync(PATCHES_DIR)) {
        console.log("No scripts/local-patches/ directory found. Nothing to apply.");
        return;
    }

    const patchFiles = fs
        .readdirSync(PATCHES_DIR)
        .filter((f) => f.endsWith(".patch"))
        .sort();

    if (patchFiles.length === 0) {
        console.log("No patch files found. Nothing to apply.");
        return;
    }

    const failed = [];
    const applied = [];

    for (const file of patchFiles) {
        const fullPath = path.join(PATCHES_DIR, file);
        try {
            git(["apply", "--check", fullPath]);
            git(["apply", fullPath]);
            applied.push(file);
            console.log(`  ✔ applied ${file}`);
        } catch (err) {
            failed.push(file);
            console.log(`  ✘ FAILED  ${file}`);
        }
    }

    console.log(`\n${applied.length} applied, ${failed.length} failed.`);
    if (failed.length > 0) {
        console.log(
            "\nConflicting patches (upstream changed these lines) — reapply by hand, then re-run save-local-patches.js:",
        );
        for (const f of failed) console.log(`  scripts/local-patches/${f}`);
        process.exitCode = 1;
    }
}

main();
