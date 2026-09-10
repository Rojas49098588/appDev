import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import TabIcon, { type TabIconName } from '../components/TabIcon';
import HomeScreen from './HomeScreen';
import InventoryScreen from './InventoryScreen';
import PlaceholderScreen from './PlaceholderScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, TabIconName> = {
  Home: 'home',
  Sections: 'sections',
  Catalogue: 'catalogue',
  Inventory: 'inventory',
};

export default function MainTabs({ navigation, route }: Props) {
  const { firstName, lastName, instrument, role } = route.params;

  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabel: ({ color }) => (
          <Text style={[styles.tabLabel, { color }]}>{tabRoute.name}</Text>
        ),
        tabBarIcon: ({ color }) => (
          <TabIcon name={TAB_ICONS[tabRoute.name as keyof MainTabParamList]} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home">
        {(tabProps) => (
          <HomeScreen
            {...tabProps}
            firstName={firstName}
            lastName={lastName}
            onAvatarPress={() =>
              navigation.navigate('Profile', { firstName, lastName, instrument, role })
            }
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Sections">
        {() => <PlaceholderScreen title="Sections" />}
      </Tab.Screen>
      <Tab.Screen name="Catalogue">
        {() => <PlaceholderScreen title="Catalogue" />}
      </Tab.Screen>
      <Tab.Screen name="Inventory" component={InventoryScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
  },
  tabLabel: {
    fontFamily: fonts.body,
    fontSize: 9.5,
  },
});
