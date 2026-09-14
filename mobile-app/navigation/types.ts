export type Role = 'Member' | 'Staff';

export type UserParams = {
  firstName: string;
  lastName: string;
  instrument: string;
  role: Role;
};

export type RootStackParamList = {
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
  MemberAccount: UserParams;
  FlagItem: { piece: string; color: string; size: string };
};

export type MainTabParamList = {
  Home: undefined;
  Sections: { piece?: string; status?: 'repair' | 'dirty' } | undefined;
  Catalogue: undefined;
  Inventory: undefined;
};

export type MemberTabParamList = {
  GameDay: undefined;
  Sizes: undefined;
  Inventory: undefined;
};
