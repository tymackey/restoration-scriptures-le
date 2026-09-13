import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useCallback } from "react";
import { Volume, Book } from "./types";
import { CustomTokenizer } from "../util/CustomTokenizer";
import { useUserDatabase } from "./UserDatabaseContext";
import { Highlight, AnnotationItem } from "./UserDatabaseSchema";
import { UuidGenerator } from "../util/UuidGenerator";

const tcOrder = [
    ["ccbackground:0", "ocforeword:0"],
    ["jshistory:20", "section:2"],
    ["section:109", "lecture:preface"],
    ["lecture:7", "section:111"],
    ["section:144", "abraham:fac1"],
    ["abraham:fac3", "section:146"],
    ["section:170", "toj:1"],
    ["toj:12", "section:172"],
    ["section:185", "tcappendix:sectionendnotes"],
    ["tcappendix:sectionendnotes", "tcappendix:excludedrevelations"],
    ["tcappendix:excludedrevelations", "tcappendix:timeline"],
    ["tcappendix:timeline", "tcappendix:maps"],
    ["tcappendix:maps", "cctitle:0"],
];

export function useDatabase() {
    const db = useSQLiteContext();
    const userDb = useUserDatabase();

    useEffect(() => {
        (async () => {
            try {
                // Set up database configuration for optimal FTS5 performance and stability
                await db.execAsync("PRAGMA temp_store = MEMORY");
                await db.execAsync("PRAGMA journal_mode = WAL");
                await db.execAsync("PRAGMA page_size = 32768");
                await db.execAsync("PRAGMA synchronous = NORMAL");
                await db.execAsync("PRAGMA cache_size = 2000");

                // Configure FTS5-specific settings for better stability
                await db.execAsync("PRAGMA fts5_tokenize = porter");

                // Only run optimize if database is in a stable state
                try {
                    await db.execAsync("PRAGMA optimize");
                } catch (optimizeError) {
                    console.warn(
                        "PRAGMA optimize failed during initialization:",
                        optimizeError,
                    );
                    // This is safe to ignore during initialization
                }
            } catch (error) {
                console.error("Error setting database PRAGMAs:", error);
            }
        })();
    }, [db]);

    const getRow = useCallback(
        async (sql: string, params: any[]): Promise<any> => {
            try {
                const result = await db.getFirstAsync(sql, params);
                return result;
            } catch (error) {
                console.error(
                    "Database getRow error:",
                    error,
                    "SQL:",
                    sql,
                    "Params:",
                    params,
                );
                throw error;
            }
        },
        [db],
    );

    const getRows = useCallback(
        async (sql: string, params: any[]) => {
            try {
                const result = await db.getAllAsync(sql, params);
                return result;
            } catch (error) {
                console.error(
                    "Database getRows error:",
                    error,
                    "SQL:",
                    sql,
                    "Params:",
                    params,
                );
                throw error;
            }
        },
        [db],
    );

    const getVolumes = useCallback(async (): Promise<Volume[]> => {
        return (await getRows(
            `SELECT * FROM volumes WHERE volume_order > 0 ORDER BY volume_order ASC`,
            [],
        )) as Volume[];
    }, [getRows]);

    const getBooks = useCallback(
        async (volumeId: string): Promise<Book[]> => {
            return (await getRows(
                `select b.book_id as id, 
              b.volume_id,
              COALESCE(reference_name, name) as name, 
              COUNT(c.book_id) as num_chapters
              from books b, chapters c
              where b.volume_id = ? and b.volume_id = c.volume_id and b.book_id = c.book_id
              group by b.book_id order by b.book_order, c.chapter_id`,
                [volumeId],
            )) as Book[];
        },
        [getRows],
    );

    const getTcBooks = useCallback(async (): Promise<any[]> => {
        return await getRows(
            `-- First part: Special books (tcforeword, tccanonization, etc.)
            SELECT
                b.book_id,
                b.volume_id,
                COALESCE(b.reference_name, b.name) as name,
                COUNT(c.book_id) as num_chapters,
                b.book_order,
                NULL as book_chapter,
                MIN(c.chapter_id) as chapter_id,
                SUBSTR(MIN(c.content), 1, 600) as preview
            FROM books b
            INNER JOIN chapters c ON b.volume_id = c.volume_id AND b.book_id = c.book_id
            WHERE b.volume_id = 'tc'
                AND b.book_id IN ('tcforeword','tccanonization','tcpreface','tcintro','epigraph')
            GROUP BY b.book_id, b.volume_id, b.reference_name, b.name, b.book_order

            UNION ALL

            -- Second part: Section chapters
            SELECT
                b.book_id,
                c.volume_id,
                c.chapter_name as name,
                1 as num_chapters,
                b.book_order,
                CASE
                    WHEN c.book_chapter GLOB '[0-9]*' THEN CAST(c.book_chapter AS INTEGER)
                    ELSE NULL
                END as book_chapter,
                c.chapter_id,
                SUBSTR(c.content, 1, 600) as preview
            FROM chapters c
            INNER JOIN books b ON c.volume_id = b.volume_id AND c.book_id = b.book_id
            WHERE c.volume_id = 'tc'
                AND c.book_id = 'section'
            GROUP BY c.chapter_name, b.book_id, c.volume_id, b.book_order, c.book_chapter, c.chapter_id, c.content

            UNION ALL

            -- Third part: Appendix chapters
            SELECT
                b.book_id,
                c.volume_id,
                c.chapter_name as name,
                1 as num_chapters,
                b.book_order,
                c.book_chapter,
                c.chapter_id,
                SUBSTR(c.content, 1, 600) as preview
            FROM chapters c
            INNER JOIN books b ON c.volume_id = b.volume_id AND c.book_id = b.book_id
            WHERE c.volume_id = 'tc'
                AND c.book_id = 'tcappendix'

            ORDER BY book_order, book_chapter, chapter_id`,
            [],
        );
    }, [getRows]);

    const getChapters = useCallback(
        async (bookId: string, volumeId: string): Promise<any[]> => {
            return await getRows(
                `select chapter_id, volume_id, book_id, book_chapter, chapter_name as name, SUBSTR(content, 1, 600) as preview
          from chapters
          where book_id = ? and volume_id = ?`,
                [bookId, volumeId],
            );
        },
        [getRows],
    );

    const getChapterByName = useCallback(
        async (name: string, volumeId: string): Promise<any[]> => {
            return await getRows(
                `select chapter_id, volume_id, book_id, book_chapter, chapter_name as name
          from chapters
          where chapter_name = ? and volume_id = ?`,
                [name, volumeId],
            );
        },
        [getRows],
    );

    const getTCChapter = useCallback(
        async (
            bookId: string,
            bookChapter: string,
            name: string,
        ): Promise<any> => {
            let sql = `select chapter_id, chapter_name as name
          from chapters
          where volume_id = 'tc' and book_id = ?`;

            if (bookChapter) {
                sql += ` and book_chapter = ?`;
            }

            if (name) {
                sql += ` and chapter_name = ?`;
            }

            let params = [bookId];
            if (bookChapter) {
                params.push(bookChapter);
            }

            if (name) {
                params.push(name);
            }

            return await getRow(sql, params);
        },
        [getRow],
    );

    const getFirstChapterByVolume = useCallback(
        async (volumeId: string): Promise<any> => {
            return await getRow(
                `select chapter_id, volume_id, book_id, book_chapter, chapter_name as name
          from chapters
          where volume_id = ?
          order by chapter_id ASC`,
                [volumeId],
            );
        },
        [getRow],
    );

    const getPreviousChapter = useCallback(
        async (
            chapterId: string,
            bookId: string,
            bookChapter: string,
        ): Promise<any> => {
            const diffOrder = tcOrder.find(
                (arr) => arr[1] === `${bookId}:${bookChapter}`,
            );
            if (diffOrder) {
                const [newBookId, newBookChapter] = diffOrder[0].split(":");
                return await getRow(
                    `select chapter_id, volume_id, book_id, book_chapter, chapter_name as name from chapters where book_id = ? and book_chapter = ?`,
                    [newBookId, newBookChapter],
                );
            } else {
                return await getRow(
                    `select chapter_id, volume_id, book_id, book_chapter, chapter_name as name from chapters where chapter_id = ?`,
                    [parseInt(chapterId) - 1],
                );
            }
        },
        [getRow],
    );

    const getNextChapter = useCallback(
        async (
            chapterId: string,
            bookId: string,
            bookChapter: string,
        ): Promise<any> => {
            if (bookChapter === "maps") return Promise.reject("end");

            const diffOrder = tcOrder.find(
                (arr) => arr[0] === `${bookId}:${bookChapter}`,
            );
            if (diffOrder) {
                const [newBookId, newBookChapter] = diffOrder[1].split(":");
                return await getRow(
                    `select chapter_id, volume_id, book_id, book_chapter, chapter_name as name from chapters where book_id = ? and book_chapter = ?`,
                    [newBookId, newBookChapter],
                );
            } else {
                return await getRow(
                    `select chapter_id, volume_id, book_id, book_chapter, chapter_name as name from chapters where chapter_id = ?`,
                    [parseInt(chapterId) + 1],
                );
            }
        },
        [getRow],
    );

    const getChapterText = useCallback(
        async (chapterId: string): Promise<string> => {
            const row = await getRow(
                "select content from chapters where chapter_id = ?",
                [chapterId],
            );
            return row?.content || "";
        },
        [getRow],
    );

    async function getGlossaryEntries(): Promise<any[]> {
        return await getRows(
            "select chapter_id, chapter_name as name from chapters where volume_id = 'tc' AND book_id = 'glossary'",
            [],
        );
    }

    async function getCanonicalBook(synonym: string): Promise<string> {
        const sql = `SELECT canonical FROM synonyms WHERE synonym = ?`;
        const result = await getRow(sql, [synonym]);
        return new Promise((resolve, reject) => {
            if (result) {
                return resolve(result.canonical);
            }
            // Fallback for PGP synonyms removed from the synonyms table in the v3.1.0 db migration
            const removedPgpSynonyms: Record<string, string> = {
                moses: "moses",
                "js-m": "js-m",
                "joseph smith matthew": "js-m",
                "joseph smith - matthew": "js-m",
                aof: "aof",
                "a of f": "aof",
                "articles of faith": "aof",
            };
            if (removedPgpSynonyms[synonym]) {
                return resolve(removedPgpSynonyms[synonym]);
            }
            return reject(new Error(`No canonical book found for ${synonym}`));
        });
    }

    async function getLEReferences(
        book: string,
        chapter: number,
        start_paragraph: number,
        end_paragraph: number,
    ): Promise<any[]> {
        let params = [book, chapter];
        if (start_paragraph) {
            if (end_paragraph) {
                params = params.concat([
                    start_paragraph.toString(),
                    end_paragraph.toString(),
                ]);
            } else {
                params.push(start_paragraph.toString());
            }
        }
        let sql = `
          WITH verse_ranges AS (
            -- Get the min and max verses for each chapter in the filtered range
            SELECT 
              target_book,
              target_chapter,
              MIN(target_verse) as min_verse,
              MAX(target_verse) as max_verse,
              -- Get verses in our filtered range for this chapter
              COUNT(*) as verses_in_range,
              -- Get the total verses in the complete chapter (removing our WHERE filters)
              (SELECT COUNT(*) 
               FROM reference_mapping rm2 
               WHERE rm2.target_book = rm1.target_book 
               AND rm2.target_chapter = rm1.target_chapter) as total_chapter_verses
            FROM reference_mapping rm1
            WHERE 
              book = ? AND 
              chapter = ?
          `;

        if (start_paragraph) {
            if (end_paragraph) {
                sql += ` AND paragraph BETWEEN ? AND ? `;
            } else {
                sql += ` AND paragraph = ? `;
            }
        }

        sql += `
            GROUP BY target_book, target_chapter
          ),
          chapter_coverage AS (
            -- Compare verses in range to total verses to determine complete chapter coverage
            SELECT
              target_book,
              target_chapter,
              min_verse,
              max_verse,
              -- Chapter is complete if we have all verses
              verses_in_range = total_chapter_verses as is_complete_chapter
            FROM verse_ranges
          )
          SELECT 
            target_book,
            target_chapter,
            min_verse,
            max_verse,
            is_complete_chapter,
            -- Format the reference string
            CASE 
              WHEN min_verse = max_verse 
              THEN target_chapter || ':' || min_verse
              ELSE target_chapter || ':' || min_verse || '-' || max_verse
            END as verse_range
          FROM chapter_coverage
          ORDER BY target_chapter, min_verse;`;

        return await getRows(sql, params);
    }

    async function getREReferences(
        book: string,
        chapter: number,
        startVerse: number,
        endVerse: number,
    ): Promise<any[]> {
        let sql, key, params;

        sql = `SELECT rm.re_key,v.volume_id,b.book_id,
              c.book_chapter as chapter,c.chapter_id,c.chapter_name as name, rm.paragraph, MIN(rm.paragraph) as start_paragraph,
              MAX(rm.paragraph) as end_paragraph
          FROM reference_mapping rm
          JOIN volumes v ON rm.volume = v.volume_id
          JOIN books b ON rm.volume = b.volume_id AND rm.book = b.book_id
          JOIN chapters c ON rm.volume = c.volume_id AND rm.book = c.book_id AND rm.chapter = c.book_chapter
          WHERE target_book = ? AND 
          (${!startVerse ? "target_chapter" : "target_key"} = ? 
          ${startVerse && endVerse ? " OR target_key = ?" : ""})
          GROUP BY volume, chapter
          ORDER BY volume ASC`;

        key = !startVerse
            ? chapter.toString()
            : chapter.toString() + ":" + startVerse.toString();
        params = [book, key];
        if (startVerse && endVerse) {
            params.push(chapter.toString() + ":" + endVerse.toString());
        }

        return await getRows(sql, params);
    }

    async function getBookReferenceName(canonical: string): Promise<any> {
        const sql = `SELECT COALESCE(reference_name, name) as name FROM books WHERE book_id = ? ORDER BY rowid ASC`;
        return await getRow(sql, [canonical]);
    }

    async function getLDSBookNames(): Promise<
        { volume_id: string; book_id: string; name: string }[]
    > {
        return (await getRows(
            `-- OC and NT books
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books
            WHERE (volume_id IN ('oc', 'nt') AND book_id NOT IN ('ejacob'))

            UNION ALL

            -- BOFM books
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books
            WHERE volume_id = 'bofm'

            UNION ALL

            -- D&C and Pearl of Great Price equivalents (dc/pgp volumes removed in v3.1.0 db)
            SELECT 'tc' as volume_id, 'section' as book_id, 'D&C' as name
            UNION ALL
            SELECT 'tc' as volume_id, 'jshistory' as book_id, 'JS-H' as name
            UNION ALL
            SELECT 'tc' as volume_id, 'abraham' as book_id, 'Abraham' as name
            UNION ALL
            SELECT 'oc' as volume_id, 'genesis' as book_id, 'Moses' as name
            UNION ALL
            SELECT 'nt' as volume_id, 'matthew' as book_id, 'JS-M' as name
            UNION ALL
            SELECT 'tc' as volume_id, 'section' as book_id, 'A of F' as name

            ORDER BY name COLLATE NOCASE ASC`,
            [],
        )) as { volume_id: string; book_id: string; name: string }[];
    }

    async function getREBookNames(): Promise<
        { volume_id: string; book_id: string; name: string }[]
    > {
        return (await getRows(
            `-- OC and NT books
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books
            WHERE (volume_id IN ('oc', 'nt') AND book_id NOT IN ('james'))

            UNION ALL

            -- BOFM books
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books
            WHERE volume_id = 'bofm'

            UNION ALL

            -- D&C and Pearl of Great Price
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books
            WHERE volume_id IN ('tc')

            ORDER BY name ASC`,
            [],
        )) as { volume_id: string; book_id: string; name: string }[];
    }

    async function getAllBookNames(): Promise<
        { volume_id: string; book_id: string; name: string }[]
    > {
        return (await getRows(
            `-- OC and NT books with (KJV) suffix
            SELECT volume_id, book_id, 'KJV ' || COALESCE(reference_name, name) as name
            FROM books
            WHERE volume_id IN ('oc', 'nt')

            UNION ALL

            -- OC and NT books with (RE) suffix
            SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
            FROM books
            WHERE volume_id IN ('oc', 'nt')

            UNION ALL

            -- BOFM books with (LDS) suffix
            SELECT volume_id, book_id, 'LDS ' || COALESCE(reference_name, name) as name
            FROM books
            WHERE volume_id = 'bofm'

            UNION ALL

            -- BOFM books with (RE) suffix
            SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
            FROM books
            WHERE volume_id = 'bofm'

            UNION ALL

            -- Abraham and Joseph Smith History with (LDS) suffix
            SELECT volume_id, book_id, 'LDS ' || COALESCE(reference_name, name) as name
            FROM books
            WHERE book_id IN ('abraham', 'jshistory')

            UNION ALL

            -- Abraham and Joseph Smith History with (RE) suffix
            SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
            FROM books
            WHERE book_id IN ('abraham', 'jshistory')

            UNION ALL

            -- TC and other books as-is (no duplicates, no suffix)
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books
            WHERE (volume_id = 'tc' OR volume_id = 'pgp' OR volume_id = 'dc')
                AND book_id NOT IN ('abraham', 'jshistory', 'js-h')

            ORDER BY name ASC`,
            [],
        )) as { volume_id: string; book_id: string; name: string }[];
    }

    const searchKeywords = useCallback(
        async (
            searchTerm: string,
            orderByRelevance: boolean,
            filterVolume: string | undefined,
            filterBook: string | undefined,
        ): Promise<
            {
                volume: string;
                volume_id: string;
                book: string;
                book_id: string;
                chapter: string;
                chapter_id: string;
                name: string;
                position: number;
                text: string;
                fullText: string;
            }[]
        > => {
            // Validate and sanitize search term to prevent FTS5 issues
            if (!searchTerm || searchTerm.trim().length === 0) {
                return [];
            }

            // Use enhanced custom tokenizer to handle apostrophes in both search terms and database content
            const processedSearchTerm =
                CustomTokenizer.generateApostropheAwareSearch(searchTerm);

            // Additional safety: limit search term length to prevent memory issues
            if (processedSearchTerm.length > 500) {
                // Increased limit for complex search patterns
                throw new Error("Search term too long");
            }

            const orderBy = orderByRelevance ? "RANK" : "p.ROWID";
            let sql = `SELECT
            v.name as volume,
            v.volume_id,
            COALESCE(b.reference_name, b.name) as book,
            p.book_id as book_id,
            p.chapter_id as chapter,
            c.chapter_id,
            c.chapter_name as name,
            p.position,
            p.paratext,
            snippet(fts_paragraphs,5,'','','...',64) as text,
            para.text as fullText
        FROM fts_paragraphs p
        JOIN volumes v ON p.volume_id = v.volume_id
        JOIN books b ON p.volume_id = b.volume_id AND p.book_id = b.book_id
        JOIN chapters c ON p.volume_id = c.volume_id AND p.book_id = c.book_id AND p.chapter_id = c.book_chapter
        JOIN paragraphs para ON p.volume_id = para.volume_id AND p.book_id = para.book_id AND p.chapter_id = para.chapter_id AND p.position = para.position
        WHERE fts_paragraphs MATCH ?`;
            let params: string[] = [processedSearchTerm];

            if (filterVolume) {
                sql += ` AND p.volume_id = ?`;
                params.push(filterVolume);
            }

            if (filterBook) {
                sql += ` AND p.book_id = ?`;
                params.push(filterBook);
            }

            sql += ` ORDER BY ${orderBy} LIMIT 1000;`; // Add limit to prevent memory issues

            try {
                const results = await getRows(sql, params);
                return results as {
                    volume: string;
                    volume_id: string;
                    book: string;
                    book_id: string;
                    chapter: string;
                    chapter_id: string;
                    name: string;
                    position: number;
                    paratext: string;
                    text: string;
                    fullText: string;
                }[];
            } catch (error) {
                console.error("FTS5 search error:", error);
                // If FTS5 search fails, return empty results instead of crashing
                // This prevents the app from crashing when FTS5 resources are being cleaned up
                return [];
            }
        },
        [getRows],
    );

    const getChapterParagraphs = useCallback(
        async (
            volumeId: string,
            bookId: string,
            chapterId: string,
        ): Promise<any[]> => {
            return await getRows(
                `
      SELECT volume_id, book_id, chapter_id, position, paratext
      FROM paragraphs
      WHERE volume_id = ? AND book_id = ? AND chapter_id = ?
      `,
                [volumeId, bookId, chapterId],
            );
        },
        [getRows],
    );

    async function getNumParagraphs(
        volumeId: string,
        bookId: string,
        chapterId: string,
    ): Promise<number> {
        const result = await getRow(
            `
      SELECT position as num_paragraphs FROM paragraphs
      WHERE volume_id = ? AND book_id = ? 
      AND chapter_id = ? 
      ORDER BY position DESC
      LIMIT 1`,
            [volumeId, bookId, chapterId],
        );
        return result.num_paragraphs;
    }

    const getChapterByReference = useCallback(
        async (
            book: string,
            chapter: string,
            edition?: string,
        ): Promise<any> => {
            // Several Book of Mormon books share a book_id with the Covenant of
            // Christ (cc) volume (e.g. mosiah, 1nephi). The reference's edition
            // suffix disambiguates: "CE" targets the Covenant of Christ, while
            // "RE"/no suffix targets the standard Restoration Edition volume.
            // When no edition is given we preserve the original volume_order
            // ordering so existing callers behave exactly as before.
            const ed = (edition || "").toUpperCase();
            const ccPreference =
                ed === "CE"
                    ? "(c.volume_id = 'cc') DESC, "
                    : ed
                      ? "(c.volume_id = 'cc') ASC, "
                      : "";
            const sql = `
          SELECT chapter_id, c.volume_id, book_id, book_chapter, chapter_name as name
          FROM chapters c, volumes v
          WHERE c.volume_id = v.volume_id
          AND book_id = ? AND book_chapter = ?
          ORDER BY ${ccPreference}v.volume_order ASC
          LIMIT 1
      `;

            return await getRow(sql, [book, chapter]);
        },
        [getRow],
    );

    // Book names used to auto-detect scripture references in reader text.
    // Restricted to synonym forms actually written inline (full names, numbered
    // books like "2 nephi", three-letter Bible abbreviations like "heb"/"rom"/
    // "mrk" used in T&C 110's "KJV [RE]" bracketed references, and RE-specific
    // abbreviations such as "t&c"/"tsj"). Only one- and two-letter converter
    // abbreviations ("is", "am", "re") are excluded — those collide with common
    // words when paired with a chapter:verse; three letters is long enough that
    // a stray match right before "N:N" essentially never happens in prose.
    const getReferenceBookNames = useCallback(async (): Promise<string[]> => {
        const rows = (await getRows(
            `SELECT DISTINCT synonym FROM synonyms
             WHERE length(synonym) >= 3
                OR synonym LIKE '%&%'`,
            [],
        )) as { synonym: string }[];
        return rows.map((r) => r.synonym);
    }, [getRows]);

    // ===== USER DATABASE FUNCTIONS (Highlights) =====

    /**
     * Add a new highlight to the user database
     * @param volume_id - Volume ID (e.g., "bofm", "cc")
     * @param book_id - Book ID (e.g., "1ne", "ccforeword")
     * @param book_chapter - Chapter number/ID (e.g., "1", "2a", "glossary")
     * @param paragraph_position - Numeric ID of the start paragraph HTML element
     * @param start_offset - Character offset from the start of paragraph_position to selection start
     * @param end_offset - Character offset from the start of end_paragraph_position to selection end
     * @param selected_text - The actual selected text (for validation/display)
     * @param color - Highlight color (default: yellow)
     * @param mark_type - 'highlight' or 'underline'
     * @param end_paragraph_position - Numeric ID of the end paragraph (null = same as paragraph_position)
     * @returns UUID of the created highlight
     */
    const addHighlight = useCallback(
        async (
            volume_id: string,
            book_id: string,
            book_chapter: string,
            paragraph_position: number,
            start_offset: number,
            end_offset: number,
            selected_text: string,
            color: string = "#FFFF00",
            mark_type: "highlight" | "underline" = "highlight",
            end_paragraph_position: number | null = null,
        ): Promise<string> => {
            const isMultiParagraph =
                end_paragraph_position !== null &&
                end_paragraph_position !== paragraph_position;

            try {
                // Check for exact duplicate highlight (same position and offsets)
                const exactDuplicate = await userDb.getFirstAsync<{
                    id: string;
                }>(
                    `SELECT id FROM highlights
                 WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
                 AND paragraph_position = ? AND start_offset = ? AND end_offset = ?
                 AND end_paragraph_position IS ?`,
                    [
                        volume_id,
                        book_id,
                        book_chapter,
                        paragraph_position,
                        start_offset,
                        end_offset,
                        end_paragraph_position,
                    ],
                );

                if (exactDuplicate) {
                    console.log(
                        "Highlight already exists at this position:",
                        exactDuplicate.id,
                    );
                    return exactDuplicate.id;
                }

                // For single-paragraph highlights, check if this is a subset of an existing one
                if (!isMultiParagraph) {
                    const containingHighlight = await userDb.getFirstAsync<{
                        id: string;
                        selected_text: string;
                    }>(
                        `SELECT id, selected_text FROM highlights
                     WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
                     AND paragraph_position = ?
                     AND (end_paragraph_position IS NULL OR end_paragraph_position = paragraph_position)
                     AND start_offset <= ? AND end_offset >= ?`,
                        [
                            volume_id,
                            book_id,
                            book_chapter,
                            paragraph_position,
                            start_offset,
                            end_offset,
                        ],
                    );

                    if (containingHighlight) {
                        console.log(
                            `Cannot create highlight - it is a subset of existing highlight "${containingHighlight.selected_text}"`,
                        );
                        return containingHighlight.id;
                    }
                }

                // Create new highlight
                const id = UuidGenerator.generate();
                await userDb.runAsync(
                    `INSERT INTO highlights
                 (id, volume_id, book_id, book_chapter, paragraph_position,
                  end_paragraph_position, start_offset, end_offset, selected_text, color, mark_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        volume_id,
                        book_id,
                        book_chapter,
                        paragraph_position,
                        end_paragraph_position,
                        start_offset,
                        end_offset,
                        selected_text,
                        color,
                        mark_type,
                    ],
                );

                console.log("Highlight added:", id);
                return id;
            } catch (error) {
                console.error("Error adding highlight:", error);
                throw error;
            }
        },
        [userDb],
    );

    /**
     * Get all highlights for a specific chapter
     * @returns Array of Highlight objects, sorted by paragraph position and offset
     */
    const getChapterHighlights = useCallback(
        async (
            volume_id: string,
            book_id: string,
            book_chapter: string,
        ): Promise<Highlight[]> => {
            try {
                const highlights = await userDb.getAllAsync<Highlight>(
                    `SELECT * FROM highlights
                 WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
                 ORDER BY paragraph_position ASC, start_offset ASC`,
                    [volume_id, book_id, book_chapter],
                );

                return highlights;
            } catch (error) {
                console.error("Error fetching chapter highlights:", error);
                return [];
            }
        },
        [userDb],
    );

    /**
     * Delete a highlight by ID
     */
    const deleteHighlight = useCallback(
        async (id: string): Promise<void> => {
            try {
                await userDb.runAsync(`DELETE FROM highlights WHERE id = ?`, [
                    id,
                ]);
                console.log("Highlight deleted:", id);
            } catch (error) {
                console.error("Error deleting highlight:", error);
                throw error;
            }
        },
        [userDb],
    );

    /**
     * Update the color (and optionally mark_type) of an existing highlight
     */
    async function updateHighlightColor(
        id: string,
        color: string,
        mark_type?: "highlight" | "underline",
    ): Promise<void> {
        try {
            if (mark_type !== undefined) {
                await userDb.runAsync(
                    `UPDATE highlights
                     SET color = ?, mark_type = ?, modified_at = datetime('now')
                     WHERE id = ?`,
                    [color, mark_type, id],
                );
            } else {
                await userDb.runAsync(
                    `UPDATE highlights
                     SET color = ?, modified_at = datetime('now')
                     WHERE id = ?`,
                    [color, id],
                );
            }
            console.log("Highlight updated:", id, color, mark_type);
        } catch (error) {
            console.error("Error updating highlight:", error);
            throw error;
        }
    }

    /**
     * Update only the mark_type of an existing highlight
     */
    async function updateHighlightMarkType(
        id: string,
        mark_type: "highlight" | "underline",
    ): Promise<void> {
        try {
            await userDb.runAsync(
                `UPDATE highlights
                 SET mark_type = ?, modified_at = datetime('now')
                 WHERE id = ?`,
                [mark_type, id],
            );
            console.log("Highlight mark_type updated:", id, mark_type);
        } catch (error) {
            console.error("Error updating highlight mark_type:", error);
            throw error;
        }
    }

    /**
     * Get all highlights across all chapters (for export/backup)
     */
    async function getAllHighlights(): Promise<Highlight[]> {
        try {
            const highlights = await userDb.getAllAsync<Highlight>(
                `SELECT * FROM highlights ORDER BY created_at DESC, rowid DESC`,
            );
            return highlights;
        } catch (error) {
            console.error("Error fetching all highlights:", error);
            return [];
        }
    }

    /**
     * Get all highlights of a given mark_type, enriched with book/chapter display info.
     */
    const getAnnotationsByType = useCallback(
        async (
            mark_type: "highlight" | "underline",
        ): Promise<AnnotationItem[]> => {
            try {
                const highlights = await userDb.getAllAsync<Highlight>(
                    `SELECT * FROM highlights WHERE mark_type = ? ORDER BY created_at DESC, rowid DESC`,
                    [mark_type],
                );

                if (highlights.length === 0) return [];

                const uniqueBookIds = [
                    ...new Set(highlights.map((h) => h.book_id)),
                ];
                const uniqueVolumeIds = [
                    ...new Set(highlights.map((h) => h.volume_id)),
                ];
                const bookPlaceholders = uniqueBookIds.map(() => "?").join(",");
                const volPlaceholders = uniqueVolumeIds
                    .map(() => "?")
                    .join(",");

                const books = (await getRows(
                    `SELECT book_id, COALESCE(reference_name, name) as name FROM books WHERE book_id IN (${bookPlaceholders})`,
                    uniqueBookIds,
                )) as { book_id: string; name: string }[];

                const bookNameMap = new Map(
                    books.map((b) => [b.book_id, b.name]),
                );

                const chapters = (await getRows(
                    `SELECT book_id, book_chapter, chapter_id, chapter_name FROM chapters WHERE book_id IN (${bookPlaceholders})`,
                    uniqueBookIds,
                )) as {
                    book_id: string;
                    book_chapter: string;
                    chapter_id: number;
                    chapter_name: string;
                }[];

                const chapterMap = new Map(
                    chapters.map((c) => [`${c.book_id}|${c.book_chapter}`, c]),
                );

                const volumes = (await getRows(
                    `SELECT volume_id, COALESCE(reference_name, name) as name FROM volumes WHERE volume_id IN (${volPlaceholders})`,
                    uniqueVolumeIds,
                )) as { volume_id: string; name: string }[];

                const volumeNameMap = new Map(
                    volumes.map((v) => [v.volume_id, v.name]),
                );

                return highlights.map((h) => {
                    const chapterInfo = chapterMap.get(
                        `${h.book_id}|${h.book_chapter}`,
                    );
                    return {
                        ...h,
                        book_name: bookNameMap.get(h.book_id) ?? h.book_id,
                        chapter_id: chapterInfo?.chapter_id ?? 0,
                        chapter_name: chapterInfo?.chapter_name ?? "",
                        volume_name:
                            volumeNameMap.get(h.volume_id) ?? h.volume_id,
                    };
                });
            } catch (error) {
                console.error("Error fetching annotations:", error);
                return [];
            }
        },
        [userDb, getRows],
    );

    /**
     * Delete all highlights of a given mark_type.
     */
    const deleteAllAnnotationsByType = useCallback(
        async (mark_type: "highlight" | "underline"): Promise<void> => {
            try {
                await userDb.runAsync(
                    `DELETE FROM highlights WHERE mark_type = ?`,
                    [mark_type],
                );
            } catch (error) {
                console.error("Error deleting annotations by type:", error);
                throw error;
            }
        },
        [userDb],
    );

    /**
     * Remove duplicate highlights (keeps the oldest one)
     * Useful for cleaning up duplicates created before deduplication logic was added
     */
    async function deduplicateHighlights(): Promise<number> {
        try {
            const result = await userDb.runAsync(
                `DELETE FROM highlights
                 WHERE id NOT IN (
                     SELECT MIN(id)
                     FROM highlights
                     GROUP BY volume_id, book_id, book_chapter,
                              paragraph_position, start_offset, end_offset
                 )`,
            );
            const deletedCount = result.changes || 0;
            console.log(`Removed ${deletedCount} duplicate highlights`);
            return deletedCount;
        } catch (error) {
            console.error("Error deduplicating highlights:", error);
            throw error;
        }
    }

    return {
        // Scripture database functions
        getVolumes,
        getBooks,
        getTcBooks,
        getChapters,
        getChapterByName,
        getTCChapter,
        getFirstChapterByVolume,
        getPreviousChapter,
        getNextChapter,
        getChapterText,
        getGlossaryEntries,
        getCanonicalBook,
        getLEReferences,
        getREReferences,
        getBookReferenceName,
        getLDSBookNames,
        getREBookNames,
        getAllBookNames,
        searchKeywords,
        getChapterParagraphs,
        getNumParagraphs,
        getChapterByReference,
        getReferenceBookNames,

        // User database functions (Highlights)
        addHighlight,
        getChapterHighlights,
        deleteHighlight,
        updateHighlightColor,
        updateHighlightMarkType,
        getAllHighlights,
        getAnnotationsByType,
        deleteAllAnnotationsByType,
        deduplicateHighlights,
    };
}
