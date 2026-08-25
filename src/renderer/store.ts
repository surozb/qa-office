import { create } from 'zustand';
import type { OfficeState } from '../shared/types';

interface OfficeUi {
  state: OfficeState | null; selected: string | null; follow: boolean;
  setState(s: OfficeState): void; select(id: string | null): void; toggleFollow(): void;
}
export const useOffice = create<OfficeUi>((set) => ({
  state: null, selected: null, follow: false,
  setState: (state) => set({ state }),
  select: (selected) => set((u) => ({ selected, follow: selected === u.selected ? u.follow : false })),
  toggleFollow: () => set((u) => ({ follow: !u.follow })),
}));
