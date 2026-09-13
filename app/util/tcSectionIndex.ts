/** Keep the original navigation records, with a numeric index into one flat list. */
export type TcIndexItem = {
    name: string;
    book_id: string;
    book_chapter?: number | string;
};

const appendixOrder = [
    "Section Endnotes", "Excluded Revelations", "A Prophet's Prerogative",
    "A Glossary of Terms", "Correlation Tables", "Timeline Of The Fathers", "Maps",
];

export function buildTcSectionIndex<T extends TcIndexItem>(source: readonly T[]) {
    const numbered = (item: T) => item.book_id === "section" &&
        Number.isInteger(Number(item.book_chapter)) && Number(item.book_chapter) > 0;
    const sections = source.filter(numbered)
        .sort((a, b) => Number(a.book_chapter) - Number(b.book_chapter));
    const front = source.filter(item => !numbered(item) && item.book_id !== "tcappendix");
    const appendix = source.filter(item => item.book_id === "tcappendix")
        .sort((a, b) => {
            const rank = (name: string) => {
                const index = appendixOrder.indexOf(name);
                return index < 0 ? appendixOrder.length : index;
            };
            return rank(a.name) - rank(b.name);
        });
    const items = [...front, ...sections, ...appendix];
    const shortcuts: { label: string; index: number; accessibilityLabel: string }[] = [];
    if (front.length) shortcuts.push({ label: "↑", index: 0, accessibilityLabel: "Jump to introduction" });
    sections.forEach((item, index) => {
        const section = Number(item.book_chapter);
        if (index === 0 || section % 10 === 0) {
            shortcuts.push({ label: String(section), index: front.length + index,
                accessibilityLabel: `Jump to section ${section}` });
        }
    });
    if (appendix.length) shortcuts.push({ label: "↓", index: front.length + sections.length,
        accessibilityLabel: "Jump to appendix" });
    return { items, shortcuts };
}
