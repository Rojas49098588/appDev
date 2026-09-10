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
  Sections: undefined;
  Catalogue: undefined;
  Inventory: undefined;
};
