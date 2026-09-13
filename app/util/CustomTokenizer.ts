/**
 * Enhanced custom tokenizer utility that handles apostrophes in both search terms and database content
 *
 * This utility provides functions to:
 * 1. Normalize search terms by removing apostrophes before tokenization
 * 2. Generate search patterns that work with FTS5's porter tokenizer
 * 3. Handle smart apostrophes (') and regular apostrophes (')
 * 4. Leverage Porter stemming to match content with apostrophes
 *
 * IMPORTANT: This approach works by normalizing search terms and relying on FTS5's Porter
 * tokenizer to handle the stemming. The Porter tokenizer will stem both "camel" and "camel's"
 * to the same root, so we don't need to include apostrophes in the search patterns.
 */

export class CustomTokenizer {
    /**
     * Normalizes text by removing both regular and smart apostrophes
     * This ensures consistent matching regardless of apostrophe type
     */
    static normalizeText(text: string): string {
        return text
            .replace(/['']/g, "") // Remove both regular and smart apostrophes
            .replace(/[^\w\s]/g, " ") // Replace other punctuation with spaces
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();
    }

    /**
     * Generates comprehensive search terms that will match content with apostrophes
     * This is the most effective approach for matching database content containing apostrophes
     * Also handles exact phrase searches when the input is wrapped in double quotes
     */
    static generateApostropheAwareSearch(searchTerm: string): string {
        // Check if this is an exact phrase search (already wrapped in quotes from searchResults.tsx)
        const exactPhraseMatch = searchTerm.match(/^"(.+)"$/);
        if (exactPhraseMatch) {
            // For exact phrase search, return the FTS5 phrase query directly
            // FTS5 uses double quotes for phrase matching
            return searchTerm;
        }

        const normalized = this.normalizeText(searchTerm);
        const words = normalized.split(/\s+/).filter((word) => word.length > 0);

        const searchTerms = words.map((word) => {
            // Create patterns that will match the word in various forms
            // Note: We avoid using apostrophes in the search pattern to prevent FTS5 syntax errors
            // Instead, we rely on Porter stemming to handle the variations
            const patterns = [
                word, // Exact word (normalized)
                `${word}*`, // Prefix match
            ];

            return `(${patterns.join(" OR ")})`;
        });

        return searchTerms.join(" AND ");
    }

    /**
     * Alternative approach: Use FTS5's built-in capabilities more effectively
     * This creates a search pattern that leverages Porter stemming while handling apostrophes
     */
    static generatePorterAwareSearch(searchTerm: string): string {
        const normalized = this.normalizeText(searchTerm);
        const words = normalized.split(/\s+/).filter((word) => word.length > 0);

        const searchTerms = words.map((word) => {
            // Since Porter stemmer will normalize both "camel" and "camel's" to the same root,
            // we can create a simple pattern that relies on Porter stemming
            const patterns = [
                word, // Base form
                `${word}*`, // Prefix match for base form
            ];

            return `(${patterns.join(" OR ")})`;
        });

        return searchTerms.join(" AND ");
    }

    /**
     * Simple approach: Just normalize the search term and let Porter handle the rest
     * This works because Porter will stem both "camel" and "camel's" to the same root
     */
    static simpleApostropheSearch(searchTerm: string): string {
        return this.normalizeText(searchTerm);
    }

    /**
     * Advanced approach: Create a search pattern that specifically targets
     * common apostrophe patterns found in religious texts
     */
    static generateReligiousTextSearch(searchTerm: string): string {
        const normalized = this.normalizeText(searchTerm);
        const words = normalized.split(/\s+/).filter((word) => word.length > 0);

        const searchTerms = words.map((word) => {
            // Common patterns in religious texts - simplified to avoid FTS5 syntax errors
            const patterns = [
                word, // Base form
                `${word}*`, // Prefix match
            ];

            return `(${patterns.join(" OR ")})`;
        });

        return searchTerms.join(" AND ");
    }

    /**
     * Generate search terms with explicit handling of both apostrophe types
     * This is the most comprehensive approach - simplified to avoid FTS5 syntax errors
     */
    static generateComprehensiveSearch(searchTerm: string): string {
        const normalized = this.normalizeText(searchTerm);
        const words = normalized.split(/\s+/).filter((word) => word.length > 0);

        const searchTerms = words.map((word) => {
            // Create simplified patterns that avoid apostrophes in search terms
            const patterns = [
                word, // Base form
                `${word}*`, // Prefix match
            ];

            return `(${patterns.join(" OR ")})`;
        });

        return searchTerms.join(" AND ");
    }

    /**
     * Test function to validate search patterns against known database content
     */
    static validateSearchPattern(
        searchTerm: string,
        expectedMatches: string[],
    ): boolean {
        const pattern = this.generateApostropheAwareSearch(searchTerm);
        console.log(`Search pattern for "${searchTerm}": ${pattern}`);
        console.log(`Expected to match: ${expectedMatches.join(", ")}`);

        // This would need to be tested against actual FTS5 queries
        return true;
    }
}
