import { create } from "zustand";
import { SectionGroup } from "./types";

interface TCState {
    selectedGroup: SectionGroup | null;
    setSelectedGroup: (group: SectionGroup | null) => void;
}

export const useTCStore = create<TCState>((set) => ({
    selectedGroup: null,
    setSelectedGroup: (group) => set({ selectedGroup: group }),
}));
