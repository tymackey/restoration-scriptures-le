export type Book = {
    id: string;
    volume_id: string;
    name: string;
    num_chapters: number;
    book_order?: number;
    book_chapter?: number;
};

export type Chapter = {
    volume_id: string;
    book_id: string;
    chapter_id: string;
    name: string;
    book_chapter: number;
    position: number;
    preview?: string;
};

export type SectionGroup = {
    start: number;
    end: number;
    sections: Chapter[];
};

export type HistoryItem = {
    volume: string;
    book: string;
    chapter: string;
    paragraph: string;
    name: string;
    chapter_id: string;
    datetime: string;
};

export type Volume = {
    volume_id: string;
    name: string;
    reference_name?: string;
};

export type Reference = {
    book_id?: string;
    target_book?: string;
    is_complete_chapter?: boolean;
    chapter?: number;
    target_chapter?: number;
    start_paragraph?: number;
    end_paragraph?: number;
    verse_range?: string;
    label?: string;
    volume_id?: string;
};
