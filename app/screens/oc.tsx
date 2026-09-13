import { useEffect, useState } from "react";
import { useDatabase } from "../data/useDatabase";
import VolumeList from "../components/VolumeList";

export default function OldCovenants() {
    const { getBooks } = useDatabase();
    const volumeId = "oc";
    const [books, setBooks] = useState<any[]>([]);

    useEffect(() => {
        const fetchBooks = async (volumeId: string) => {
            const books = await getBooks(volumeId);
            setBooks(books);
        };
        fetchBooks(volumeId);
    }, [volumeId, getBooks]);

    return <VolumeList items={books} />;
}
