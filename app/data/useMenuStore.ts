import { create } from "zustand";

interface MenuState {
    isVisible: boolean;
    anchor: { x: number; y: number };
    width: number;
    menuItems: React.ReactNode;
    showMenu: (
        anchor: { x: number; y: number },
        width: number,
        menuItems: React.ReactNode,
    ) => void;
    hideMenu: () => void;
}

export const useMenuStore = create<MenuState>((set) => ({
    isVisible: false,
    anchor: { x: 0, y: 0 },
    width: 240,
    menuItems: null,
    showMenu: (anchor, width, menuItems) =>
        set({
            isVisible: true,
            anchor,
            width,
            menuItems,
        }),
    hideMenu: () =>
        set({
            isVisible: false,
            anchor: { x: 0, y: 0 },
            width: 240,
            menuItems: null,
        }),
}));
