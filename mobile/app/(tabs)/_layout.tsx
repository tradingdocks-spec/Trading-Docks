import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccount } from '@/providers/account';
import { color, elevation, radius } from '@/design';
import {
  getMobileBottomBarHeight,
  getMobileTabOptions,
  type MobileTabRouteName,
} from '@/services/navigation-contract';

const tabRoutes: MobileTabRouteName[] = ['index', 'collection', 'scan', 'deal-desk', 'sell', 'profile'];

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

  return (
    <Tabs
      screenOptions={({ route }) => {
        const options = getMobileTabOptions(accountType, route.name as MobileTabRouteName);
        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: color.primaryBright,
          tabBarInactiveTintColor: color.textMuted,
          tabBarStyle: [
            s.tab,
            {
              height: getMobileBottomBarHeight(insets.bottom),
              paddingBottom: Math.max(insets.bottom, 6),
            },
          ],
          tabBarItemStyle: s.item,
          tabBarLabelStyle: s.label,
          tabBarIcon: ({ color: iconColor, focused }) => {
            return options.prominent ? (
              <View style={[s.center, focused && s.centerActive]}>
                <Ionicons
                  name={(focused ? options.icon : options.inactiveIcon) as any}
                  color={focused ? color.text : iconColor}
                  size={22}
                />
              </View>
            ) : (
              <Ionicons
                name={(focused ? options.icon : options.inactiveIcon) as any}
                color={iconColor}
                size={22}
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
    paddingTop: 7,
    backgroundColor: '#081625F7',
    borderTopWidth: 1,
    borderTopColor: color.border,
    borderWidth: 0,
    borderRadius: 0,
    ...elevation.raised,
  },
  item: {
    minHeight: 48,
    paddingTop: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
    marginTop: 1,
  },
  center: {
    width: 42,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: `${color.primary}24`,
    borderWidth: 1,
    borderColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerActive: {
    backgroundColor: color.primary,
    borderColor: color.primaryBright,
  },
});
