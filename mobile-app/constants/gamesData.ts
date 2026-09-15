export type Game = {
  opponent: string;
  date: string;
  preGameComboId: string;
  halftimeComboId: string;
  afterGameInstructions: string;
  instructionsPostedBy: string;
  instructionsUpdatedAt: string;
};

export const CURRENT_GAME: Game = {
  opponent: 'Lincoln High',
  date: 'Fri, Sep 18',
  preGameComboId: 'combo-01',
  halftimeComboId: 'combo-14',
  afterGameInstructions:
    'Leave all pieces draped over chairs to air out. Return bowties to the front table. Either take your white shirt home to wash, or leave it in the blue bin.',
  instructionsPostedBy: 'Coach Reyes',
  instructionsUpdatedAt: 'Sep 15',
};
