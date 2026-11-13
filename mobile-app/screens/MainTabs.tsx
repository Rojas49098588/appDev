import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { fonts } from '../constants/fonts';
import TabIcon, { type TabIconName } from '../components/TabIcon';
import OfflineBanner from '../components/OfflineBanner';
import HomeScreen from './HomeScreen';
import InventoryScreen from './InventoryScreen';
import SectionsScreen from './SectionsScreen';
import CatalogueScreen from './CatalogueScreen';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, TabIconName> = {
  Home: 'home',
  Sections: 'sections',
  Catalogue: 'catalogue',
  Inventory: 'inventory',
};

export default function MainTabs({ navigation, route }: Props) {
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
          <Text style={[styles.tabLabel, { color }]} maxFontSizeMultiplier={1.3}>{tabRoute.name}</Text>
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
      <Tab.Screen name="Sections" component={SectionsScreen} />
      <Tab.Screen name="Catalogue" component={CatalogueScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
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
