export type Game = {
  opponent: string;
  date: string;
  preGameComboId: string;
  halftimeComboId: string;
};

export const CURRENT_GAME: Game = {
  opponent: 'Lincoln High',
  date: 'Fri, Sep 18',
  preGameComboId: 'combo-01',
  halftimeComboId: 'combo-14',
};
