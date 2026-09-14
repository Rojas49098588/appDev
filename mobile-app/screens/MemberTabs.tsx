import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import type { MemberTabParamList, RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import TabIcon, { type TabIconName } from '../components/TabIcon';
import PlaceholderScreen from './PlaceholderScreen';
import GameDayScreen from './member/GameDayScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberTabs'>;

const Tab = createBottomTabNavigator<MemberTabParamList>();

const TAB_ICONS: Record<keyof MemberTabParamList, TabIconName> = {
  GameDay: 'gameday',
  Sizes: 'sizes',
  Inventory: 'memberInventory',
};

const TAB_LABELS: Record<keyof MemberTabParamList, string> = {
  GameDay: 'Game day',
  Sizes: 'Sizes',
  Inventory: 'Inventory',
};

export default function MemberTabs({ navigation, route }: Props) {
  const { firstName, lastName, instrument, role } = route.params;
  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabel: ({ color }) => (
          <Text style={[styles.tabLabel, { color }]}>
            {TAB_LABELS[tabRoute.name as keyof MemberTabParamList]}
          </Text>
        ),
        tabBarIcon: ({ color }) => (
          <TabIcon name={TAB_ICONS[tabRoute.name as keyof MemberTabParamList]} color={color} />
        ),
      })}
    >
      <Tab.Screen name="GameDay">
        {(tabProps) => (
          <GameDayScreen
            {...tabProps}
            firstName={firstName}
            lastName={lastName}
            onAvatarPress={() =>
              navigation.navigate('MemberAccount', { firstName, lastName, instrument, role })
            }
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Sizes">{() => <PlaceholderScreen title="Sizes" />}</Tab.Screen>
      <Tab.Screen name="Inventory">{() => <PlaceholderScreen title="Inventory" />}</Tab.Screen>
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
