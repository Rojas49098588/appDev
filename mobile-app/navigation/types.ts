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
  Profile: UserParams;
};

export type MainTabParamList = {
  Home: undefined;
  Sections: { piece?: string; status?: 'repair' | 'dirty' } | undefined;
  Catalogue: undefined;
  Inventory: undefined;
};
