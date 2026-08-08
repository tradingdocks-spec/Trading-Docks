import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccount } from '@/providers/account';
import { color, edge, elevation, radius, surface } from '@/design';
import {
  getMobileBottomNavVisualModel,
  getMobileTabOptions,
  getMobileVisibleTabRoutes,
  shouldHideMobileTabBarForRoute,
  type MobileTabRouteName,
} from '@/services/navigation-contract';

export default function Layout() {
  const { accountType, ready } = useAccount();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={color.primaryBright} />
        <Text style={s.loadingText}>Preparing workspace navigation...</Text>
      </View>
    );
  }

  const optionsFor = (route: MobileTabRouteName) => {
    const options = getMobileTabOptions(accountType, route);
    return {
      title: options.title,
      href: options.href,
      tabBarAccessibilityLabel: options.accessibilityLabel,
    };
  };
  const navModel = getMobileBottomNavVisualModel(insets.bottom);
  const tabRoutes = getMobileVisibleTabRoutes(accountType);

  return (
    <Tabs
      screenOptions={({ route }) => {
        const options = getMobileTabOptions(accountType, route.name as MobileTabRouteName);
        const hideTabBar = shouldHideMobileTabBarForRoute(route.name as MobileTabRouteName);
        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: color.primaryBright,
          tabBarInactiveTintColor: color.textMuted,
          tabBarStyle: [
            s.tab,
            hideTabBar && s.tabHidden,
            {
              height: navModel.height,
              paddingBottom: navModel.paddingBottom,
              paddingTop: navModel.paddingTop,
            },
          ],
          tabBarItemStyle: s.item,
          tabBarLabelStyle: s.label,
          tabBarIcon: ({ color: iconColor, focused }) => {
            return options.prominent ? (
              <View
                style={[
                  s.center,
                  {
                    width: navModel.centerAction.width,
                    height: navModel.centerAction.height,
                  },
                  focused && s.centerActive,
                ]}
              >
                <Ionicons
                  name={(focused ? options.icon : options.inactiveIcon) as any}
                  color={focused ? color.text : iconColor}
                  size={navModel.iconSize}
                />
              </View>
            ) : (
              <Ionicons
                name={(focused ? options.icon : options.inactiveIcon) as any}
                color={iconColor}
                size={navModel.iconSize}
              />
            );
          },
          tabBarButton: (props) => (
            <Pressable
              {...props as any}
              accessibilityRole="tab"
              accessibilityLabel={options.accessibilityLabel}
              accessibilityState={{
                ...props.accessibilityState,
                selected: Boolean(props.accessibilityState?.selected),
              }}
              onPress={(event) => {
                if (Platform.OS !== 'web') {
                  Haptics.selectionAsync();
                }
                props.onPress?.(event as any);
              }}
              style={({ pressed }) => [
                props.style as any,
                s.tabPressArea,
                pressed && s.pressedTab,
              ]}
            />
          ),
        };
      }}
    >
      {tabRoutes.map((route) => (
        <Tabs.Screen key={route} name={route} options={optionsFor(route)} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: color.canvas,
  },
  loadingText: {
    color: color.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tab: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: `${surface.dock}F7`,
    borderTopWidth: 1,
    borderTopColor: edge.subtle,
    borderWidth: 0,
    borderRadius: 0,
    ...elevation.raised,
  },
  tabHidden: {
    display: 'none',
  },
  item: {
    minHeight: 48,
    paddingTop: 2,
  },
  tabPressArea: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedTab: {
    opacity: 0.82,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
    marginTop: 1,
    maxWidth: 76,
  },
  center: {
    borderRadius: radius.control,
    backgroundColor: `${color.primary}24`,
    borderWidth: 1,
    borderColor: edge.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerActive: {
    backgroundColor: color.primary,
    borderColor: color.primaryBright,
  },
});
