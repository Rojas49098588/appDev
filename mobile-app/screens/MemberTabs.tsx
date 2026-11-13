import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import type { MemberTabParamList, RootStackParamList } from '../navigation/types';
import { fonts } from '../constants/fonts';
import TabIcon, { type TabIconName } from '../components/TabIcon';
import OfflineBanner from '../components/OfflineBanner';
import GameDayScreen from './member/GameDayScreen';
import MySizesScreen from './member/MySizesScreen';
import MyInventoryScreen from './member/MyInventoryScreen';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { firstName, lastName, instrument, role } = route.params;
  return (
    <Tab.Navigator
      tabBar={(props) => (
        <View>
          <OfflineBanner />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={({ route: tabRoute }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabel: ({ color }) => (
          <Text style={[styles.tabLabel, { color }]} maxFontSizeMultiplier={1.3}>
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
      <Tab.Screen name="Sizes" component={MySizesScreen} />
      <Tab.Screen name="Inventory" component={MyInventoryScreen} />
    </Tab.Navigator>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  tabBar: {
    backgroundColor: t.colors.surface,
    borderTopColor: t.colors.line,
  },
  tabLabel: {
    fontFamily: fonts.body,
    fontSize: t.font(9.5),
  },
});
}
