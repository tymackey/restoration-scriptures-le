"use strict";
/* eslint-env node */

/**
 * RebuildDatabase.js
 *
 * Rebuilds assets/scriptures_v2.1.db from scratch using the XML source files
 * in scripts/0001_oc through scripts/0007_cc.
 *
 * Run from inside scripts/:
 *   npm install better-sqlite3   # one-time
 *   node RebuildDatabase.js
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const he = require("he");
const Database = require("better-sqlite3");

// ─── Paths ───────────────────────────────────────────────────────────────────

const SCRIPT_DIR = __dirname;
const OUTPUT_DB = path.join(SCRIPT_DIR, "scriptures_new.db");
const FINAL_DB = path.join(SCRIPT_DIR, "..", "assets", "scriptures_v2.1.db");
const SYNONYMS_SQL = path.join(SCRIPT_DIR, "book_synonyms.sql");
const REF_MAP_SQL = path.join(SCRIPT_DIR, "reference_mapping.sql");

// ─── Volume Config ───────────────────────────────────────────────────────────
//
// To update: edit the name/reference_name fields below.
// volume_order > 0 means visible in the app's volume navigation.

const VOLUMES = [
    {
        dir: "0001_oc",
        volume_id: "oc",
        name: "The Old Covenants",
        volume_order: 2,
        reference_name: "Old Covenants",
    },
    {
        dir: "0002_nc",
        volume_id: "nc",
        name: "The New Covenants",
        volume_order: 3,
        reference_name: "New Covenants",
    },
    {
        dir: "0003_nt",
        volume_id: "nt",
        name: "The New Testament",
        volume_order: 4,
        reference_name: "New Testament",
    },
    {
        dir: "0004_bofm",
        volume_id: "bofm",
        name: "The Book of Mormon",
        volume_order: 5,
        reference_name: "Book of Mormon",
    },
    {
        dir: "0005_glossary",
        volume_id: "gl",
        name: "A Glossary of Gospel Terms",
        volume_order: 7,
        reference_name: null,
    },
    {
        dir: "0006_tc",
        volume_id: "tc",
        name: "Teachings & Commandments",
        volume_order: 6,
        reference_name: null,
    },
    {
        dir: "0007_cc",
        volume_id: "cc",
        name: "Covenant of Christ",
        volume_order: 1,
        reference_name: null,
    },
];

// Volumes with no source directories (needed for reference_mapping foreign keys
// or app navigation shims).
const EXTRA_VOLUMES = [
    {
        volume_id: "pgp",
        name: "The Pearl of Great Price",
        volume_order: 0,
        reference_name: "Pearl of Great Price",
    },
    {
        volume_id: "dc",
        name: "The Doctrine & Covenants",
        volume_order: 0,
        reference_name: "Doctrine & Covenants",
    },
];

// ─── Book Config ─────────────────────────────────────────────────────────────
//
// Keyed as BOOKS[volume_id][directory_suffix].
// book_id     — value stored in the database (may differ from dir suffix)
// name        — full display name
// reference_name — short display name used in chapter_name and book lists
//                  (null means use `name` directly)
// book_order  — sort order within the volume

const BOOKS = {
    nc: {
        ncforeword: {
            book_id: "ncforeword",
            name: "Foreword",
            book_order: 1,
            reference_name: null,
        },
        nccanonization: {
            book_id: "nccanonization",
            name: "Canonization",
            book_order: 2,
            reference_name: null,
        },
    },
    oc: {
        ocforeword: {
            book_id: "ocforeword",
            name: "Foreword",
            book_order: 1,
            reference_name: null,
        },
        occanonization: {
            book_id: "occanonization",
            name: "Canonization",
            book_order: 2,
            reference_name: null,
        },
        ocpreface: {
            book_id: "ocpreface",
            name: "Preface",
            book_order: 3,
            reference_name: null,
        },
        genesis: {
            book_id: "genesis",
            name: "Genesis",
            book_order: 4,
            reference_name: null,
        },
        exodus: {
            book_id: "exodus",
            name: "Exodus",
            book_order: 5,
            reference_name: null,
        },
        leviticus: {
            book_id: "leviticus",
            name: "Leviticus",
            book_order: 6,
            reference_name: null,
        },
        numbers: {
            book_id: "numbers",
            name: "Numbers",
            book_order: 7,
            reference_name: null,
        },
        deuteronomy: {
            book_id: "deuteronomy",
            name: "Deuteronomy",
            book_order: 8,
            reference_name: null,
        },
        joshua: {
            book_id: "joshua",
            name: "Joshua",
            book_order: 9,
            reference_name: null,
        },
        judges: {
            book_id: "judges",
            name: "Judges",
            book_order: 10,
            reference_name: null,
        },
        ruth: {
            book_id: "ruth",
            name: "Ruth",
            book_order: 11,
            reference_name: null,
        },
        "1samuel": {
            book_id: "1samuel",
            name: "1 Samuel",
            book_order: 12,
            reference_name: null,
        },
        "2samuel": {
            book_id: "2samuel",
            name: "2 Samuel",
            book_order: 13,
            reference_name: null,
        },
        "1kings": {
            book_id: "1kings",
            name: "1 Kings",
            book_order: 14,
            reference_name: null,
        },
        "2kings": {
            book_id: "2kings",
            name: "2 Kings",
            book_order: 15,
            reference_name: null,
        },
        "1chronicles": {
            book_id: "1chronicles",
            name: "1 Chronicles",
            book_order: 16,
            reference_name: null,
        },
        "2chronicles": {
            book_id: "2chronicles",
            name: "2 Chronicles",
            book_order: 17,
            reference_name: null,
        },
        ezra: {
            book_id: "ezra",
            name: "Ezra",
            book_order: 18,
            reference_name: null,
        },
        nehemiah: {
            book_id: "nehemiah",
            name: "Nehemiah",
            book_order: 19,
            reference_name: null,
        },
        esther: {
            book_id: "esther",
            name: "Esther",
            book_order: 20,
            reference_name: null,
        },
        job: {
            book_id: "job",
            name: "Job",
            book_order: 21,
            reference_name: null,
        },
        psalm: {
            book_id: "psalm",
            name: "Psalms",
            book_order: 22,
            reference_name: null,
        },
        proverbs: {
            book_id: "proverbs",
            name: "Proverbs",
            book_order: 23,
            reference_name: null,
        },
        ecclesiastes: {
            book_id: "ecclesiastes",
            name: "Ecclesiastes",
            book_order: 24,
            reference_name: null,
        },
        isaiah: {
            book_id: "isaiah",
            name: "Isaiah",
            book_order: 25,
            reference_name: null,
        },
        jeremiah: {
            book_id: "jeremiah",
            name: "Jeremiah",
            book_order: 26,
            reference_name: null,
        },
        lamentations: {
            book_id: "lamentations",
            name: "Lamentations",
            book_order: 27,
            reference_name: null,
        },
        ezekiel: {
            book_id: "ezekiel",
            name: "Ezekiel",
            book_order: 28,
            reference_name: null,
        },
        daniel: {
            book_id: "daniel",
            name: "Daniel",
            book_order: 29,
            reference_name: null,
        },
        hosea: {
            book_id: "hosea",
            name: "Hosea",
            book_order: 30,
            reference_name: null,
        },
        joel: {
            book_id: "joel",
            name: "Joel",
            book_order: 31,
            reference_name: null,
        },
        amos: {
            book_id: "amos",
            name: "Amos",
            book_order: 32,
            reference_name: null,
        },
        obadiah: {
            book_id: "obadiah",
            name: "Obadiah",
            book_order: 33,
            reference_name: null,
        },
        jonah: {
            book_id: "jonah",
            name: "Jonah",
            book_order: 34,
            reference_name: null,
        },
        micah: {
            book_id: "micah",
            name: "Micah",
            book_order: 35,
            reference_name: null,
        },
        nahum: {
            book_id: "nahum",
            name: "Nahum",
            book_order: 36,
            reference_name: null,
        },
        habakkuk: {
            book_id: "habakkuk",
            name: "Habakkuk",
            book_order: 37,
            reference_name: null,
        },
        zephaniah: {
            book_id: "zephaniah",
            name: "Zephaniah",
            book_order: 38,
            reference_name: null,
        },
        haggai: {
            book_id: "haggai",
            name: "Haggai",
            book_order: 39,
            reference_name: null,
        },
        zechariah: {
            book_id: "zechariah",
            name: "Zechariah",
            book_order: 40,
            reference_name: null,
        },
        malachi: {
            book_id: "malachi",
            name: "Malachi",
            book_order: 41,
            reference_name: null,
        },
    },
    nt: {
        ntpreface: {
            book_id: "ntpreface",
            name: "Preface",
            book_order: 1,
            reference_name: null,
        },
        matthew: {
            book_id: "matthew",
            name: "The Testimony of St. Matthew",
            book_order: 2,
            reference_name: "Matthew",
        },
        mark: {
            book_id: "mark",
            name: "The Testimony of St. Mark",
            book_order: 3,
            reference_name: "Mark",
        },
        luke: {
            book_id: "luke",
            name: "The Testimony of St. Luke",
            book_order: 4,
            reference_name: "Luke",
        },
        john: {
            book_id: "john",
            name: "The Testimony of St. John",
            book_order: 5,
            reference_name: "John",
        },
        acts: {
            book_id: "acts",
            name: "Acts of The Apostles",
            book_order: 6,
            reference_name: "Acts",
        },
        romans: {
            book_id: "romans",
            name: "The Epistle to The Romans",
            book_order: 7,
            reference_name: "Romans",
        },
        "1corinthians": {
            book_id: "1corinthians",
            name: "The First Epistle to The Corinthians",
            book_order: 8,
            reference_name: "1 Corinthians",
        },
        "2corinthians": {
            book_id: "2corinthians",
            name: "The Second Epistle to The Corinthians",
            book_order: 9,
            reference_name: "2 Corinthians",
        },
        galatians: {
            book_id: "galatians",
            name: "The Epistle to The Galatians",
            book_order: 10,
            reference_name: "Galatians",
        },
        ephesians: {
            book_id: "ephesians",
            name: "The Epistle to The Ephesians",
            book_order: 11,
            reference_name: "Ephesians",
        },
        philippians: {
            book_id: "philippians",
            name: "The Epistle to The Philippians",
            book_order: 12,
            reference_name: "Philippians",
        },
        colossians: {
            book_id: "colossians",
            name: "The Epistle to The Colossians",
            book_order: 13,
            reference_name: "Colossians",
        },
        "1thessalonians": {
            book_id: "1thessalonians",
            name: "The First Epistle to The Thessalonians",
            book_order: 14,
            reference_name: "1 Thessalonians",
        },
        "2thessalonians": {
            book_id: "2thessalonians",
            name: "The Second Epistle to The Thessalonians",
            book_order: 15,
            reference_name: "2 Thessalonians",
        },
        "1timothy": {
            book_id: "1timothy",
            name: "The First Epistle to Timothy",
            book_order: 16,
            reference_name: "1 Timothy",
        },
        "2timothy": {
            book_id: "2timothy",
            name: "The Second Epistle to Timothy",
            book_order: 17,
            reference_name: "2 Timothy",
        },
        titus: {
            book_id: "titus",
            name: "The Epistle to Titus",
            book_order: 18,
            reference_name: "Titus",
        },
        philemon: {
            book_id: "philemon",
            name: "The Epistle to Philemon",
            book_order: 19,
            reference_name: "Philemon",
        },
        hebrews: {
            book_id: "hebrews",
            name: "The Epistle to The Hebrews",
            book_order: 20,
            reference_name: "Hebrews",
        },
        james: {
            book_id: "james",
            name: "The Epistle of James",
            book_order: 21,
            reference_name: "James",
        },
        "1peter": {
            book_id: "1peter",
            name: "The First Epistle of Peter",
            book_order: 22,
            reference_name: "1 Peter",
        },
        "2peter": {
            book_id: "2peter",
            name: "The Second Epistle of Peter",
            book_order: 23,
            reference_name: "2 Peter",
        },
        "1john": {
            book_id: "1john",
            name: "The First Epistle of John",
            book_order: 24,
            reference_name: "1 John",
        },
        "2john": {
            book_id: "2john",
            name: "The Second Epistle of John",
            book_order: 25,
            reference_name: "2 John",
        },
        "3john": {
            book_id: "3john",
            name: "The Third Epistle of John",
            book_order: 26,
            reference_name: "3 John",
        },
        jude: {
            book_id: "jude",
            name: "The Epistle of Jude",
            book_order: 27,
            reference_name: "Jude",
        },
        revelation: {
            book_id: "revelation",
            name: "The Revelations of St. John",
            book_order: 28,
            reference_name: "Revelation",
        },
    },
    bofm: {
        bompreface: {
            book_id: "bompreface",
            name: "Preface",
            book_order: 1,
            reference_name: null,
        },
        bomintro: {
            book_id: "bomintro",
            name: "Introduction",
            book_order: 2,
            reference_name: null,
        },
        title: {
            book_id: "bomtitle",
            name: "Title Page",
            book_order: 3,
            reference_name: null,
        },
        tow: {
            book_id: "bomtow",
            name: "Testimonies of Witnesses",
            book_order: 4,
            reference_name: null,
        },
        "1nephi": {
            book_id: "1nephi",
            name: "The First Book of Nephi",
            book_order: 5,
            reference_name: "1 Nephi",
        },
        "2nephi": {
            book_id: "2nephi",
            name: "The Second Book of Nephi",
            book_order: 6,
            reference_name: "2 Nephi",
        },
        jacob: {
            book_id: "jacob",
            name: "The Book of Jacob",
            book_order: 7,
            reference_name: "Jacob",
        },
        enos: {
            book_id: "enos",
            name: "The Book of Enos",
            book_order: 8,
            reference_name: "Enos",
        },
        jarom: {
            book_id: "jarom",
            name: "The Book of Jarom",
            book_order: 9,
            reference_name: "Jarom",
        },
        omni: {
            book_id: "omni",
            name: "The Book of Omni",
            book_order: 10,
            reference_name: "Omni",
        },
        words: {
            book_id: "words",
            name: "Words of Mormon",
            book_order: 11,
            reference_name: "Words",
        },
        mosiah: {
            book_id: "mosiah",
            name: "The Book of Mosiah",
            book_order: 12,
            reference_name: "Mosiah",
        },
        alma: {
            book_id: "alma",
            name: "The Book of Alma",
            book_order: 13,
            reference_name: "Alma",
        },
        helaman: {
            book_id: "helaman",
            name: "The Book of Helaman",
            book_order: 14,
            reference_name: "Helaman",
        },
        "3nephi": {
            book_id: "3nephi",
            name: "The Third Book of Nephi",
            book_order: 15,
            reference_name: "3 Nephi",
        },
        "4nephi": {
            book_id: "4nephi",
            name: "The Fourth Book of Nephi",
            book_order: 16,
            reference_name: "4 Nephi",
        },
        mormon: {
            book_id: "mormon",
            name: "The Book of Mormon",
            book_order: 17,
            reference_name: "Mormon",
        },
        ether: {
            book_id: "ether",
            name: "The Book of Ether",
            book_order: 18,
            reference_name: "Ether",
        },
        moroni: {
            book_id: "moroni",
            name: "The Book of Moroni",
            book_order: 19,
            reference_name: "Moroni",
        },
    },
    gl: {
        glforeword: {
            book_id: "glforeword",
            name: "Foreword",
            book_order: 1,
            reference_name: null,
        },
        glintroduction: {
            book_id: "glintroduction",
            name: "Introduction",
            book_order: 2,
            reference_name: null,
        },
        // 'entries' directory maps to book_id 'glossary'; uses glossaryTerm XML attribute for chapter names
        entries: {
            book_id: "glossary",
            name: "Glossary of Gospel Terms",
            book_order: 3,
            reference_name: null,
        },
    },
    tc: {
        tcforeword: {
            book_id: "tcforeword",
            name: "Foreword",
            book_order: 1,
            reference_name: null,
        },
        tccanonization: {
            book_id: "tccanonization",
            name: "Canonization",
            book_order: 2,
            reference_name: null,
        },
        tcpreface: {
            book_id: "tcpreface",
            name: "Preface",
            book_order: 3,
            reference_name: null,
        },
        tcintro: {
            book_id: "tcintro",
            name: "Introduction",
            book_order: 4,
            reference_name: null,
        },
        section: {
            book_id: "section",
            name: "Sections",
            book_order: 5,
            reference_name: null,
        },
        jshistory: {
            book_id: "jshistory",
            name: "Joseph Smith History",
            book_order: 6,
            reference_name: null,
        },
        lecture: {
            book_id: "lecture",
            name: "Lectures on Faith",
            book_order: 7,
            reference_name: null,
        },
        abraham: {
            book_id: "abraham",
            name: "The Book of Abraham",
            book_order: 8,
            reference_name: null,
        },
        toj: {
            book_id: "toj",
            name: "The Testimony of John",
            book_order: 9,
            reference_name: null,
        },
        // 'appendix' directory maps to book_id 'tcappendix'
        appendix: {
            book_id: "tcappendix",
            name: "Appendix",
            book_order: 10,
            reference_name: null,
        },
    },
    cc: {
        // 'title' directory maps to book_id 'cctitle' (disambiguates from bofm 'title')
        title: {
            book_id: "cctitle",
            name: "Dedication",
            book_order: 1,
            reference_name: "Dedication",
        },
        ccpreface: {
            book_id: "ccpreface",
            name: "Preface",
            book_order: 2,
            reference_name: "Preface",
        },
        ccintro: {
            book_id: "ccintro",
            name: "Introduction",
            book_order: 3,
            reference_name: "Introduction",
        },
        ccprayeranswer: {
            book_id: "ccprayeranswer",
            name: "Prayer",
            book_order: 4,
            reference_name: "Prayer",
        },
        "1nephi": {
            book_id: "1nephi",
            name: "The First Book of Nephi",
            book_order: 5,
            reference_name: "1 Nephi",
        },
        "2nephi": {
            book_id: "2nephi",
            name: "The Second Book of Nephi",
            book_order: 6,
            reference_name: "2 Nephi",
        },
        jacob: {
            book_id: "jacob",
            name: "The Book of Jacob",
            book_order: 7,
            reference_name: "Jacob",
        },
        enos: {
            book_id: "enos",
            name: "The Book of Enos",
            book_order: 8,
            reference_name: "Enos",
        },
        jarom: {
            book_id: "jarom",
            name: "The Book of Jarom",
            book_order: 9,
            reference_name: "Jarom",
        },
        omni: {
            book_id: "omni",
            name: "The Book of Omni",
            book_order: 10,
            reference_name: "Omni",
        },
        words: {
            book_id: "words",
            name: "Words of Mormon",
            book_order: 11,
            reference_name: "Words",
        },
        mosiah: {
            book_id: "mosiah",
            name: "The Book of Mosiah",
            book_order: 12,
            reference_name: "Mosiah",
        },
        alma: {
            book_id: "alma",
            name: "The Book of Alma",
            book_order: 13,
            reference_name: "Alma",
        },
        helaman: {
            book_id: "helaman",
            name: "The Book of Helaman",
            book_order: 14,
            reference_name: "Helaman",
        },
        "3nephi": {
            book_id: "3nephi",
            name: "The Third Book of Nephi",
            book_order: 15,
            reference_name: "3 Nephi",
        },
        "4nephi": {
            book_id: "4nephi",
            name: "The Fourth Book of Nephi",
            book_order: 16,
            reference_name: "4 Nephi",
        },
        mormon: {
            book_id: "mormon",
            name: "The Book of Mormon",
            book_order: 17,
            reference_name: "Mormon",
        },
        ether: {
            book_id: "ether",
            name: "The Book of Ether",
            book_order: 18,
            reference_name: "Ether",
        },
        moroni: {
            book_id: "moroni",
            name: "The Book of Moroni",
            book_order: 19,
            reference_name: "Moroni",
        },
        ccordinances: {
            book_id: "ccordinances",
            name: "Ordinances",
            book_order: 20,
            reference_name: null,
        },
        ccfirstnations: {
            book_id: "ccfirstnations",
            name: "To the First Nations",
            book_order: 21,
            reference_name: null,
        },
        cctow: {
            book_id: "cctow",
            name: "Testimonies of Witnesses",
            book_order: 22,
            reference_name: "Testimonies of Witnesses",
        },
        ccbackground: {
            book_id: "ccbackground",
            name: "Background",
            book_order: 23,
            reference_name: null,
        },
    },
};

// ─── Schema DDL ──────────────────────────────────────────────────────────────

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA page_size = 32768;

CREATE TABLE volumes (
    volume_id      TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    volume_order   INTEGER NOT NULL,
    reference_name TEXT,
    PRIMARY KEY(volume_id)
);

CREATE TABLE books (
    volume_id      TEXT,
    book_id        TEXT,
    name           TEXT,
    book_order     INT,
    reference_name TEXT,
    PRIMARY KEY(volume_id, book_id)
);
CREATE INDEX books_book_id_book_order_idx ON books(book_id, book_order);

CREATE TABLE chapters (
    chapter_id   INTEGER NOT NULL,
    volume_id    TEXT NOT NULL,
    book_id      TEXT NOT NULL,
    book_chapter TEXT NOT NULL,
    chapter_name TEXT,
    content      TEXT NOT NULL,
    PRIMARY KEY(chapter_id AUTOINCREMENT)
);
CREATE INDEX chapters_id_volume_id_book_id_book_chapter_chapter_name_idx
    ON chapters(chapter_id, volume_id, book_id, book_chapter, chapter_name);

CREATE TABLE paragraphs (
    paragraph_id INTEGER NOT NULL,
    volume_id    TEXT NOT NULL,
    book_id      TEXT NOT NULL,
    chapter_id   TEXT NOT NULL,
    position     INTEGER NOT NULL,
    text         TEXT NOT NULL,
    paratext     BOOLEAN NOT NULL,
    PRIMARY KEY(paragraph_id AUTOINCREMENT)
);

CREATE TABLE synonyms (
    synonym   TEXT NOT NULL UNIQUE,
    canonical TEXT NOT NULL,
    PRIMARY KEY(synonym)
);

CREATE TABLE reference_mapping (
    ref_key        TEXT NOT NULL,
    volume         TEXT NOT NULL,
    book           TEXT NOT NULL,
    chapter        INTEGER NOT NULL,
    paragraph      INTEGER NOT NULL,
    target_edition TEXT NOT NULL,
    target_work    TEXT NOT NULL,
    target_book    TEXT NOT NULL,
    target_chapter INTEGER NOT NULL,
    target_verse   INTEGER NOT NULL,
    re_key         TEXT,
    target_key     TEXT,
    PRIMARY KEY(ref_key)
);

CREATE VIRTUAL TABLE fts_paragraphs USING fts5(
    content      = 'paragraphs',
    content_rowid = 'paragraph_id',
    volume_id,
    book_id,
    chapter_id,
    position,
    paratext,
    text,
    tokenize = 'porter ascii'
);
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a string (possibly ALL CAPS) to Title Case. */
function toTitleCase(str) {
    return str
        .trim()
        .replace(
            /\w\S*/g,
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        );
}

/**
 * Parse a chapter filename (without extension) and return book_chapter.
 *
 * Patterns handled:
 *   "001.2_genesis"           → "2"       (numeric index.chapter_book)
 *   "001.0_ocforeword"        → "0"       (front matter / single chapter)
 *   "001.preface_lecture"     → "preface" (non-numeric chapter slug)
 *   "001.fac1_abraham"        → "fac1"    (non-numeric chapter slug)
 *   "001.sectionendnotes_appendix" → "sectionendnotes"
 *   "aaronic-priesthood_glossary"  → "aaronic-priesthood" (no numeric prefix)
 */
function parseBookChapter(stem) {
    // Split on dots and underscores only (not hyphens, which appear in glossary slugs)
    const dotIdx = stem.indexOf(".");
    if (dotIdx === -1) {
        // No dot — should not normally occur, fall back to the whole stem
        return stem.split("_")[0];
    }
    const prefix = stem.slice(0, dotIdx);
    const rest = stem.slice(dotIdx + 1); // everything after the first dot
    const chapterPart = rest.split("_")[0]; // up to the first underscore

    if (/^\d+$/.test(prefix)) {
        // Prefix is a numeric index — chapterPart is the book_chapter
        return chapterPart;
    } else {
        // No numeric prefix — this is a glossary-style slug filename
        return prefix;
    }
}

/**
 * Extract and format the chapter content from a parsed cheerio object.
 * Returns the inner HTML of <chapter> wrapped in <ol class="simple-text">.
 */
function formatContent($) {
    let selector = $("chapter");
    if (!selector.length) selector = $("div");

    // Remove anchor tags, keeping their inner HTML
    selector.find("a").each(function () {
        const $a = $(this);
        $a.replaceWith($a.html() || "");
    });

    const html = selector.html().trim();
    return '<ol class="simple-text">' + html + "</ol>";
}

/**
 * Derive the chapter_name from parsed XML content and book metadata.
 *
 * @param {string} volumeId
 * @param {string} bookId       — database book_id
 * @param {string} bookChapter  — the book_chapter value
 * @param {object} bookConfig   — entry from BOOKS config { name, reference_name, ... }
 * @param {CheerioStatic} $     — parsed XML
 */
function deriveChapterName(volumeId, bookId, bookChapter, bookConfig, $) {
    // ── Glossary entries: use the glossaryTerm XML attribute ──────────────────
    if (bookId === "glossary") {
        return (
            $("chapter").attr("glossaryterm") ||
            $("chapter").attr("glossaryTerm") ||
            toTitleCase(bookChapter.replace(/-/g, " "))
        );
    }

    // ── TC appendix (non-numeric slugs): title-case the section header ────────
    if (bookId === "tcappendix") {
        const header = $("h3.sectionHeader, h3.chap").first().text().trim();
        return toTitleCase(header) || bookConfig.name;
    }

    // ── Front matter (book_chapter === '0'): title-case the section header ────
    if (bookChapter === "0") {
        const header = $("h3.sectionHeader, h3.chap").first().text().trim();
        return toTitleCase(header) || bookConfig.name;
    }

    // ── TC section chapters ───────────────────────────────────────────────────
    if (bookId === "section") {
        $('h3.sectionHeader, h3[class*="sectionHeader"]')
            .find("span.trd-chap")
            .remove();
        const sectionHeader = $('h3.sectionHeader, h3[class*="sectionHeader"]')
            .first()
            .text()
            .trim();
        const bookTitle = $("h1.bookTitle").first().text().trim();
        let name = toTitleCase(sectionHeader);
        if (bookTitle) {
            name += " - " + toTitleCase(bookTitle);
        }
        return name || `Section ${bookChapter}`;
    }

    // ── Joseph Smith History: prefix book name with the Part N (dates) text ──
    if (bookId === "jshistory") {
        // h3.chap (NOT sectionHeader) contains "Part N (date range)"
        const chapText = $("h3.chap")
            .not(".sectionHeader")
            .first()
            .text()
            .trim();
        if (chapText) return `${bookConfig.name} ${chapText}`;
        return `${bookConfig.name} ${bookChapter}`;
    }

    // ── Lectures on Faith ─────────────────────────────────────────────────────
    if (bookId === "lecture") {
        if (bookChapter === "preface") return `${bookConfig.name} Preface`;
        return `${bookConfig.name} Lecture ${bookChapter}`;
    }

    // ── Book of Abraham ───────────────────────────────────────────────────────
    if (bookId === "abraham") {
        const facMatch = bookChapter.match(/^fac(\d+)$/);
        if (facMatch) return `${bookConfig.name} Facsimile ${facMatch[1]}`;
        return `${bookConfig.name} ${bookChapter}`;
    }

    // ── Testimony of John ─────────────────────────────────────────────────────
    if (bookId === "toj") {
        return `${bookConfig.name} ${bookChapter}`;
    }

    // ── Default: numbered chapters use reference_name (or name) + chapter ─────
    const displayName = bookConfig.reference_name || bookConfig.name;
    return `${displayName} ${bookChapter}`;
}

// Books whose full-text paragraphs are extracted from the root element rather
// than from li[id] or p tags (legacy special cases from original script).
const SPECIAL_PARA_BOOKS = new Set([
    "title",
    "version",
    "assembly1835",
    "section_corr",
    "appendixa",
    "gov_principles",
]);

/**
 * Extract paragraphs from a chapter's HTML content.
 * Returns an array of { position, text, paratext } objects.
 *
 * NOTE: chapter_id in the paragraphs table stores the book_chapter TEXT value
 *       (not the integer chapters.chapter_id), because searchKeywords joins on
 *       `p.chapter_id = c.book_chapter`.
 */
function extractParagraphs(bookId, content) {
    const $ = cheerio.load(content, {
        normalizeWhiteSpace: true,
        xmlMode: true,
    });
    const paragraphs = [];

    function normalizeText(text) {
        return text
            .replace(/[\r\n]/g, " ")
            .replace(/\t/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    if (SPECIAL_PARA_BOOKS.has(bookId)) {
        const text = normalizeText($.root().text());
        if (text) paragraphs.push({ position: 0, text, paratext: 1 });
        return paragraphs;
    }

    let query = $("li[id]");
    let paratext = 0;

    if (query.length === 0) {
        query = $("ol > p, blockquote > p, div > p");
        paratext = 1;
    }

    query.each(function (i) {
        const $el = $(this);
        const text = normalizeText($el.text());
        if (!text) return;
        const position =
            paratext === 0 ? $el.attr("id") || String(i + 1) : String(i + 1);
        paragraphs.push({ position, text, paratext });
    });

    return paragraphs;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
    const errors = [];
    let chapterCount = 0;
    let paragraphCount = 0;

    // Remove any leftover output DB from a previous run
    if (fs.existsSync(OUTPUT_DB)) {
        fs.unlinkSync(OUTPUT_DB);
        console.log(`Removed existing ${path.basename(OUTPUT_DB)}`);
    }

    // ── 1. Create schema ─────────────────────────────────────────────────────
    console.log("\n=== Step 1: Creating schema ===");
    const db = new Database(OUTPUT_DB);
    db.exec(SCHEMA);
    console.log("Schema created.");

    // ── 2. Insert volumes and books ──────────────────────────────────────────
    console.log("\n=== Step 2: Inserting volumes and books ===");

    const insertVolume = db.prepare(
        `INSERT INTO volumes (volume_id, name, volume_order, reference_name) VALUES (?, ?, ?, ?)`,
    );
    const insertBook = db.prepare(
        `INSERT INTO books (volume_id, book_id, name, book_order, reference_name) VALUES (?, ?, ?, ?, ?)`,
    );

    db.transaction(() => {
        for (const v of [...VOLUMES, ...EXTRA_VOLUMES]) {
            insertVolume.run(
                v.volume_id,
                v.name,
                v.volume_order,
                v.reference_name,
            );
        }
        console.log(
            `  Inserted ${VOLUMES.length + EXTRA_VOLUMES.length} volumes.`,
        );

        // De-duplicate books — two dirs can share the same (volume_id, book_id)
        // only when they intentionally produce different chapters (e.g. 1jacob/ejacob).
        // Use INSERT OR IGNORE so the first occurrence wins for the books row.
        const insertBookIgnore = db.prepare(
            `INSERT OR IGNORE INTO books (volume_id, book_id, name, book_order, reference_name) VALUES (?, ?, ?, ?, ?)`,
        );
        let bookCount = 0;
        for (const volConfig of VOLUMES) {
            const volBooks = BOOKS[volConfig.volume_id];
            for (const bookCfg of Object.values(volBooks)) {
                insertBookIgnore.run(
                    volConfig.volume_id,
                    bookCfg.book_id,
                    bookCfg.name,
                    bookCfg.book_order,
                    bookCfg.reference_name,
                );
                bookCount++;
            }
        }
        console.log(`  Inserted ${bookCount} book config entries.`);
    })();

    // ── 3. Process chapter files ─────────────────────────────────────────────
    console.log("\n=== Step 3: Processing chapter files ===");

    const insertChapter = db.prepare(
        `INSERT INTO chapters (volume_id, book_id, book_chapter, chapter_name, content) VALUES (?, ?, ?, ?, ?)`,
    );

    const processChapters = db.transaction(() => {
        for (const volConfig of VOLUMES) {
            const volumeDir = path.join(SCRIPT_DIR, volConfig.dir);
            if (!fs.existsSync(volumeDir)) {
                console.warn(
                    `  WARNING: Volume directory not found: ${volumeDir}`,
                );
                continue;
            }
            const volumeId = volConfig.volume_id;
            const volBooks = BOOKS[volumeId];
            console.log(`\n  Volume: ${volConfig.dir} (${volumeId})`);

            const bookDirs = fs
                .readdirSync(volumeDir)
                .filter((d) => {
                    const full = path.join(volumeDir, d);
                    return fs.statSync(full).isDirectory();
                })
                .sort();

            for (const bookDir of bookDirs) {
                const dirSuffix = bookDir.replace(/^\d+_/, "");
                const bookConfig = volBooks[dirSuffix];
                if (!bookConfig) {
                    console.warn(
                        `    WARNING: No book config for dir suffix '${dirSuffix}' in volume '${volumeId}' — skipping.`,
                    );
                    errors.push(`No config: ${volConfig.dir}/${bookDir}`);
                    continue;
                }
                const bookId = bookConfig.book_id;
                const bookDir_ = path.join(volumeDir, bookDir);
                const files = fs
                    .readdirSync(bookDir_)
                    .filter((f) => f.endsWith(".xml"))
                    .sort();

                if (files.length === 0) continue;
                console.log(
                    `    ${bookDir} → ${bookId} (${files.length} files)`,
                );

                for (const file of files) {
                    try {
                        const stem = file.replace(/\.xml$/, "");
                        const bookChapter = parseBookChapter(stem);

                        const rawContent = fs.readFileSync(
                            path.join(bookDir_, file),
                            "utf8",
                        );
                        const decoded = he.decode(rawContent);
                        const $ = cheerio.load(decoded, {
                            normalizeWhiteSpace: true,
                            xmlMode: true,
                            decodeEntities: false,
                        });

                        const chapterName = deriveChapterName(
                            volumeId,
                            bookId,
                            bookChapter,
                            bookConfig,
                            $,
                        );
                        const content = formatContent($);

                        insertChapter.run(
                            volumeId,
                            bookId,
                            bookChapter,
                            chapterName,
                            content,
                        );
                        chapterCount++;
                    } catch (err) {
                        const msg = `${volConfig.dir}/${bookDir}/${file}: ${err.message}`;
                        console.error(`    ERROR: ${msg}`);
                        errors.push(msg);
                    }
                }
            }
        }
    });

    processChapters();
    console.log(`\n  Total chapters inserted: ${chapterCount}`);

    // ── 4. Build paragraphs table ────────────────────────────────────────────
    console.log("\n=== Step 4: Building paragraphs table ===");

    const allChapters = db
        .prepare(
            `SELECT chapter_id, volume_id, book_id, book_chapter, content FROM chapters ORDER BY chapter_id`,
        )
        .all();

    const insertParagraph = db.prepare(
        `INSERT INTO paragraphs (volume_id, book_id, chapter_id, position, text, paratext)
         VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const buildParagraphs = db.transaction(() => {
        for (const chapter of allChapters) {
            // paragraphs.chapter_id stores the book_chapter TEXT (not the integer chapter_id)
            // because searchKeywords joins: p.chapter_id = c.book_chapter
            const paras = extractParagraphs(chapter.book_id, chapter.content);
            for (const p of paras) {
                insertParagraph.run(
                    chapter.volume_id,
                    chapter.book_id,
                    chapter.book_chapter, // TEXT value, not integer chapter_id
                    p.position,
                    p.text,
                    p.paratext,
                );
                paragraphCount++;
            }
        }
    });

    buildParagraphs();
    console.log(`  Total paragraphs inserted: ${paragraphCount}`);

    // ── 5. Rebuild FTS5 index ────────────────────────────────────────────────
    console.log("\n=== Step 5: Building FTS5 index ===");
    db.exec(`
        INSERT INTO fts_paragraphs(rowid, volume_id, book_id, chapter_id, position, paratext, text)
        SELECT paragraph_id, volume_id, book_id, chapter_id, position, paratext, text
        FROM paragraphs;
    `);
    console.log("  FTS5 index built.");

    // ── 6. Load synonyms ─────────────────────────────────────────────────────
    console.log("\n=== Step 6: Loading synonyms ===");
    if (fs.existsSync(SYNONYMS_SQL)) {
        const sql = fs.readFileSync(SYNONYMS_SQL, "utf8");
        // book_synonyms.sql creates its own table; extract just the INSERT statements
        // and re-target them to the `synonyms` table this schema uses.
        const insertLines =
            sql.match(/INSERT INTO [`'"]?book_synonyms[`'"]?[^;]+;/gi) || [];
        if (insertLines.length > 0) {
            // book_synonyms has columns (book_id, synonym) — map to (canonical, synonym)
            db.transaction(() => {
                for (const line of insertLines) {
                    // Parse individual value tuples and insert into synonyms.
                    // book_synonyms.sql uses double-quoted strings: ("genesis", "gen")
                    const valueMatches = line.matchAll(
                        /\("([^"]+)",\s*"([^"]+)"\)/g,
                    );
                    for (const [, bookId, synonym] of valueMatches) {
                        try {
                            db.prepare(
                                `INSERT OR IGNORE INTO synonyms (synonym, canonical) VALUES (?, ?)`,
                            ).run(synonym, bookId);
                        } catch (_) {
                            /* duplicate, skip */
                        }
                    }
                }
            })();
            console.log(`  Synonyms loaded from book_synonyms.sql.`);
        } else {
            // Try executing the SQL directly if it targets the synonyms table
            try {
                db.exec(sql);
                console.log("  Synonyms loaded directly from SQL file.");
            } catch (err) {
                console.warn(
                    `  WARNING: Could not load synonyms: ${err.message}`,
                );
                errors.push(`Synonyms: ${err.message}`);
            }
        }
    } else {
        console.warn(
            `  WARNING: ${SYNONYMS_SQL} not found — synonyms table will be empty.`,
        );
        errors.push("book_synonyms.sql not found");
    }

    // ── 7. Load reference_mapping from SQL file ───────────────────────────────
    console.log("\n=== Step 7: Loading reference_mapping from SQL file ===");
    if (fs.existsSync(REF_MAP_SQL)) {
        try {
            db.exec("DROP TABLE IF EXISTS reference_mapping");
            const sql = fs.readFileSync(REF_MAP_SQL, "utf8");
            db.exec(sql);
            const count = db
                .prepare("SELECT COUNT(*) as n FROM reference_mapping")
                .get().n;
            console.log(`  Loaded ${count} reference_mapping rows.`);
        } catch (err) {
            console.warn(
                `  WARNING: Could not load reference_mapping: ${err.message}`,
            );
            errors.push(`reference_mapping: ${err.message}`);
        }
    } else {
        console.warn(
            `  WARNING: ${REF_MAP_SQL} not found — reference_mapping will be empty.`,
        );
        errors.push("reference_mapping.sql not found");
    }

    // ── 8. Finalize and copy ──────────────────────────────────────────────────
    console.log("\n=== Step 8: Optimizing and copying to assets ===");
    db.exec("PRAGMA optimize;");
    db.exec("VACUUM;");
    db.close();

    // Remove stale WAL/SHM files before overwriting the database — if these are
    // left from a previous (possibly corrupt) run, SQLite will apply them on top
    // of the freshly-copied file and corrupt it again.
    for (const suffix of ["-wal", "-shm"]) {
        const f = FINAL_DB + suffix;
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    fs.copyFileSync(OUTPUT_DB, FINAL_DB);
    fs.unlinkSync(OUTPUT_DB);
    console.log(`  Copied to ${FINAL_DB}`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n=== Build Complete ===");
    console.log(`  Chapters:   ${chapterCount}`);
    console.log(`  Paragraphs: ${paragraphCount}`);
    if (errors.length > 0) {
        console.log(`\n  ERRORS (${errors.length}):`);
        errors.forEach((e) => console.log(`    - ${e}`));
    } else {
        console.log("  No errors.");
    }
}

main();
