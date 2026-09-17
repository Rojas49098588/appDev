export type Role = 'Member' | 'Staff';

export type UserParams = {
  firstName: string;
  lastName: string;
  instrument: string;
  role: Role;
};

export type HeightValue = { feet: string; inches: string };

export type MemberProfileParams = {
  name: string;
  section: string;
  email?: string;
  phone?: string;
  height?: HeightValue;
  weight?: string;
};

export type RootStackParamList = {
  Login: undefined;
  InviteCode: undefined;
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
  MemberAccount: UserParams;
  MemberProfile: MemberProfileParams;
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
