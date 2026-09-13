/**
 * User database schema and types for storing user-generated content like highlights.
 * This database is separate from the read-only scripture database and persists across app updates.
 */

export const USER_DATABASE_VERSION = 3;

export const USER_DATABASE_SCHEMA = `
-- Version tracking for migrations
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Highlights with paragraph-relative character offsets
-- paragraph_position: numeric ID of the start paragraph HTML element
-- end_paragraph_position: numeric ID of the end paragraph (NULL = same as paragraph_position)
-- start_offset: character offset from start of paragraph_position to selection start
-- end_offset: character offset from start of end_paragraph_position to selection end
CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY NOT NULL,
  volume_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  book_chapter TEXT NOT NULL,
  paragraph_position INTEGER NOT NULL,
  end_paragraph_position INTEGER,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  selected_text TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#FFFF00',
  mark_type TEXT NOT NULL DEFAULT 'highlight',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for fast chapter lookups
CREATE INDEX IF NOT EXISTS idx_highlights_chapter
  ON highlights(volume_id, book_id, book_chapter);

CREATE INDEX IF NOT EXISTS idx_highlights_paragraph
  ON highlights(volume_id, book_id, book_chapter, paragraph_position);

CREATE INDEX IF NOT EXISTS idx_highlights_created
  ON highlights(created_at DESC);

-- Initialize version
INSERT OR IGNORE INTO schema_version (version) VALUES (${USER_DATABASE_VERSION});
`;

/**
 * Highlight data structure.
 * Stores text selections as character offsets relative to paragraph positions.
 */
export interface Highlight {
    id: string;
    volume_id: string;
    book_id: string;
    book_chapter: string; // TEXT type handles both numeric and non-numeric chapters (e.g., "1", "2a", "glossary")
    paragraph_position: number; // Numeric ID of the start paragraph HTML element
    end_paragraph_position: number | null; // Numeric ID of the end paragraph (null = same as paragraph_position)
    start_offset: number; // Character offset from the start of paragraph_position to selection start
    end_offset: number; // Character offset from the start of end_paragraph_position to selection end
    selected_text: string;
    color: string;
    mark_type: "highlight" | "underline";
    created_at: string;
    modified_at: string;
}

/**
 * Highlight enriched with display info from the main scriptures database.
 */
export interface AnnotationItem extends Highlight {
    book_name: string;
    chapter_id: number;
    chapter_name: string;
    volume_name: string;
}
