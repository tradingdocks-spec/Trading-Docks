import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccount } from '@/providers/account';
import { color, elevation, radius } from '@/design';
import { getMobileTabOptions, type MobileTabRouteName } from '@/services/navigation-contract';

const tabRoutes: MobileTabRouteName[] = ['index', 'collection', 'scan', 'deal-desk', 'sell', 'profile'];

export default function Layout() {
  const { accountType, ready } = useAccount();

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
          tabBarStyle: s.tab,
          tabBarLabelStyle: s.label,
          tabBarIcon: ({ color: iconColor, size, focused }) => {
            const base = options.icon;
            return options.prominent ? (
              <View style={[s.center, focused && s.centerActive]}>
                <Ionicons name={base as any} color="#fff" size={25} />
              </View>
            ) : (
              <Ionicons
                name={(focused ? base : `${base}-outline`) as any}
                color={iconColor}
                size={size}
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
                Haptics.selectionAsync();
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

const s=StyleSheet.create({loading:{flex:1,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:color.canvas},loadingText:{color:color.textMuted,fontSize:12,fontWeight:'700'},tab:{position:'absolute',left:14,right:14,bottom:Platform.OS==='ios'?18:10,height:Platform.OS==='ios'?76:68,paddingTop:8,paddingBottom:Platform.OS==='ios'?10:7,backgroundColor:'#0A1A2AF5',borderTopWidth:0,borderWidth:1,borderColor:color.border,borderRadius:26,...elevation.floating},label:{fontSize:10,fontWeight:'800'},center:{width:54,height:54,borderRadius:radius.lg,backgroundColor:color.primary,alignItems:'center',justifyContent:'center',marginTop:-22,borderWidth:4,borderColor:color.canvas,...elevation.floating},centerActive:{backgroundColor:color.primaryBright}});
