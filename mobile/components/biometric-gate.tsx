import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Logo } from '@/components/primitives';
import { color, radius, space, type } from '@/design';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

export function BiometricGate() {
  const { biometricError, unlockWithBiometrics } = useAuth();
  const usePassword = async () => {
    await supabase?.auth.signOut({ scope: 'local' });
    router.replace('/auth');
  };
  return <SafeAreaView style={s.safe}><View style={s.wrap}><Logo/><View style={s.icon}><Ionicons name="scan-outline" size={36} color={color.primaryBright}/></View><Text style={s.kicker}>SECURE WORKSPACE</Text><Text style={s.title}>Unlock Trading Docks</Text><Text style={s.sub}>Your signed-in session is protected on this device.</Text>{biometricError&&<Text style={s.error}>{biometricError}</Text>}<Pressable style={s.primary} onPress={unlockWithBiometrics}><Ionicons name="scan-outline" size={22} color="#fff"/><Text style={s.primaryText}>Unlock with Face ID</Text></Pressable><Pressable style={s.secondary} onPress={usePassword}><Text style={s.secondaryText}>Sign in with password</Text></Pressable></View></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:color.canvas},wrap:{flex:1,width:'100%',maxWidth:480,alignSelf:'center',alignItems:'center',justifyContent:'center',padding:space.lg,gap:space.md},icon:{width:76,height:76,borderRadius:radius.xl,backgroundColor:color.surface,borderWidth:1,borderColor:color.border,alignItems:'center',justifyContent:'center',marginTop:space.lg},kicker:{...type.label,color:color.primaryBright,marginTop:space.sm},title:{...type.display,color:color.text,textAlign:'center'},sub:{...type.body,color:color.textSecondary,textAlign:'center'},error:{...type.caption,color:'#FFB05A',textAlign:'center'},primary:{width:'100%',height:58,borderRadius:radius.md,backgroundColor:color.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,marginTop:space.md},primaryText:{color:'#fff',fontSize:15,fontWeight:'900'},secondary:{width:'100%',height:52,borderRadius:radius.md,borderWidth:1,borderColor:color.border,alignItems:'center',justifyContent:'center'},secondaryText:{color:color.text,fontWeight:'800'}});
