import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Logo } from '@/components/primitives';
import { PrimaryButton, Surface } from '@/components/foundation';
import { color, radius, space, type } from '@/design';
import { supabase } from '@/lib/supabase';
import { signInSocial } from '@/lib/oauth';
import { authPreferences } from '@/services/auth-preferences';

function CheckRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={s.checkRow}>
    <View style={[s.checkbox, checked && s.checkboxOn]}>{checked && <Ionicons name="checkmark" size={15} color="#02101C" />}</View>
    <Text style={s.checkLabel}>{label}</Text>
  </Pressable>;
}

export default function Auth(){
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [signup,setSignup]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [loadingPrefs,setLoadingPrefs]=useState(true);
  const [showPassword,setShowPassword]=useState(false);
  const [rememberEmail,setRememberEmail]=useState(true);
  const [keepSignedIn,setKeepSignedIn]=useState(true);
  const [useBiometrics,setUseBiometrics]=useState(false);

  useEffect(()=>{authPreferences.load().then(p=>{setEmail(p.email);setRememberEmail(p.rememberEmail);setKeepSignedIn(p.keepSignedIn);setUseBiometrics(p.biometricEnabled);setLoadingPrefs(false);});},[]);

  const routeAfterLogin=async()=>{
    if(!supabase){router.replace('/(tabs)');return;}
    const {data:{user}}=await supabase.auth.getUser();
    if(user){
      const {data}=await supabase.from('user_roles').select('role').eq('user_id',user.id).maybeSingle();
      if(data?.role){router.replace('/admin');return;}
    }
    router.replace('/(tabs)');
  };

  const persistChoices=async()=>{
    await authPreferences.saveLoginOptions(email,rememberEmail,keepSignedIn);
    await authPreferences.setBiometricEnabled(Platform.OS !== 'web' && useBiometrics && keepSignedIn);
  };

  const submit=async()=>{
    if(!supabase)return Alert.alert('Supabase is not configured','Add the mobile environment variables and restart Expo.');
    if(!email||password.length<6)return Alert.alert('Check your details','Use a valid email and a password with at least 6 characters.');
    setBusy(true);
    const r=signup?await supabase.auth.signUp({email:email.trim(),password}):await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(r.error){setBusy(false);return Alert.alert(signup?'Account not created':'Sign in failed',r.error.message);}
    await persistChoices();
    if(signup&&!r.data.session){setBusy(false);return Alert.alert('Check your inbox','Confirm your email, then return to sign in.');}
    await routeAfterLogin();
    setBusy(false);
  };

  const magic=async()=>{if(!supabase||!email)return Alert.alert('Enter your email','We will send a secure sign-in link.');setBusy(true);await authPreferences.saveLoginOptions(email,rememberEmail,true);const redirect=Platform.OS==='web'&&typeof window!=='undefined'?`${window.location.origin}/auth`:'tradingdocks://auth/callback';const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:redirect}});setBusy(false);if(error)return Alert.alert('Link not sent',error.message);Alert.alert('Check your inbox','Your secure Trading Docks sign-in link is on its way.');};
  const social=async(provider:'google'|'apple')=>{try{setBusy(true);await authPreferences.saveLoginOptions(email,rememberEmail,keepSignedIn);const ok=await signInSocial(provider);if(ok)await routeAfterLogin();}catch(e){Alert.alert('Social sign-in unavailable',e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}};

  if(loadingPrefs)return <SafeAreaView style={s.safe}><View style={s.loading}><ActivityIndicator color={color.primaryBright}/></View></SafeAreaView>;

  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={[s.page,desktop&&s.pageDesktop]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={[s.shell,desktop&&s.shellDesktop]}>
      <Pressable onPress={()=>router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={color.text}/></Pressable>
      <View style={[s.brandSide,desktop&&s.brandSideDesktop]}><Logo/><View><Text style={s.kicker}>{signup?'CREATE YOUR ACCOUNT':'WELCOME BACK'}</Text><Text style={[s.title,desktop&&s.titleDesktop]}>{signup?'One account for every Trading Docks workspace.':'Sign in to your Trading Docks workspace.'}</Text><Text style={s.sub}>{signup?'Start free, choose your account type, and upgrade whenever you are ready.':'Your cards, buying sessions, and Command Center stay synchronized across mobile and web.'}</Text></View><View style={s.benefit}><Ionicons name="shield-checkmark-outline" size={20} color={color.success}/><Text style={s.benefitText}>Secure Supabase authentication</Text></View><View style={s.benefit}><Ionicons name="sync-outline" size={20} color={color.primaryBright}/><Text style={s.benefitText}>One account across every workspace</Text></View></View>
      <View style={[s.formSide,desktop&&s.formSideDesktop]}>
        <Surface style={s.panel} tone="raised">
          <Text style={s.formTitle}>{signup?'Create your account':'Welcome back'}</Text><Text style={s.formSub}>{signup?'Use Google, Apple, or email to begin.':'Choose a secure sign-in method.'}</Text>
          <View style={s.socials}><Pressable onPress={()=>social('google')} disabled={busy} style={s.social}><Ionicons name="logo-google" size={20} color={color.text}/><Text style={s.socialText}>Continue with Google</Text></Pressable>{Platform.OS==='ios'&&<Pressable onPress={()=>social('apple')} disabled={busy} style={[s.social,s.apple]}><Ionicons name="logo-apple" size={21} color="#000"/><Text style={[s.socialText,{color:'#000'}]}>Continue with Apple</Text></Pressable>}</View>
          <View style={s.or}><View style={s.rule}/><Text style={s.orText}>OR CONTINUE WITH EMAIL</Text><View style={s.rule}/></View>
          <View style={s.input}><Ionicons name="mail-outline" size={19} color={color.textMuted}/><TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={color.textMuted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={s.field}/></View>
          <View style={s.input}><Ionicons name="lock-closed-outline" size={19} color={color.textMuted}/><TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={color.textMuted} secureTextEntry={!showPassword} autoComplete={signup?'new-password':'current-password'} style={s.field}/><Pressable onPress={()=>setShowPassword(v=>!v)} hitSlop={10}><Ionicons name={showPassword?'eye-off-outline':'eye-outline'} size={20} color={color.textMuted}/></Pressable></View>
          {!signup&&<View style={s.options}><CheckRow checked={rememberEmail} label="Remember my email" onPress={()=>setRememberEmail(v=>!v)}/><CheckRow checked={keepSignedIn} label="Keep me signed in" onPress={()=>setKeepSignedIn(v=>!v)}/>{Platform.OS!=='web'&&<CheckRow checked={useBiometrics} label={Platform.OS==='ios'?'Use Face ID next time':'Use biometric unlock next time'} onPress={()=>{if(!keepSignedIn)Alert.alert('Keep me signed in required','Biometric unlock protects a saved session, so enable Keep me signed in first.');else setUseBiometrics(v=>!v)}}/>}</View>}
          <PrimaryButton label={signup?'Create account':'Sign in'} busy={busy} onPress={submit}/>
          {!signup&&<Pressable onPress={magic}><Text style={s.magic}>Email me a secure sign-in link</Text></Pressable>}
          <Pressable onPress={()=>setSignup(v=>!v)}><Text style={s.switch}>{signup?'Already have an account? Sign in':'New here? Create a Trading Docks account'}</Text></Pressable>
        </Surface>
        <View style={s.trust}><Ionicons name="lock-closed-outline" size={15} color={color.success}/><Text style={s.trustText}>Trading Docks never stores your password. Face ID and biometric unlock protect an existing device session; they do not store credentials.</Text></View>
        <Pressable onPress={()=>router.replace('/(tabs)')}><Text style={s.preview}>Continue in preview mode</Text></Pressable>
      </View>
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:color.canvas},loading:{flex:1,alignItems:'center',justifyContent:'center'},page:{flexGrow:1,padding:space.lg,paddingBottom:space.xxl},pageDesktop:{justifyContent:'center',paddingHorizontal:48},shell:{width:'100%',maxWidth:560,alignSelf:'center',gap:space.lg},shellDesktop:{maxWidth:1160,flexDirection:'row',alignItems:'stretch',gap:40},back:{width:44,height:44,borderRadius:radius.md,backgroundColor:color.surface,borderWidth:1,borderColor:color.border,alignItems:'center',justifyContent:'center'},brandSide:{gap:space.lg},brandSideDesktop:{flex:1,justifyContent:'center',paddingRight:24},formSide:{gap:space.md},formSideDesktop:{width:520,justifyContent:'center'},kicker:{...type.label,color:color.primaryBright,marginBottom:space.sm},title:{...type.display,color:color.text},titleDesktop:{fontSize:48,lineHeight:52},sub:{...type.body,color:color.textSecondary,marginTop:space.sm,maxWidth:520},benefit:{flexDirection:'row',alignItems:'center',gap:10},benefitText:{color:color.textSecondary,fontWeight:'700'},panel:{gap:space.sm,padding:space.lg},formTitle:{...type.title,color:color.text},formSub:{...type.body,color:color.textSecondary,marginBottom:space.sm},socials:{gap:space.sm},social:{height:56,borderRadius:radius.md,backgroundColor:color.canvasRaised,borderWidth:1,borderColor:color.border,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},apple:{backgroundColor:'#fff',borderColor:'#fff'},socialText:{color:color.text,fontWeight:'900',fontSize:14},or:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:4},rule:{height:1,backgroundColor:color.border,flex:1},orText:{color:color.textMuted,fontSize:9,fontWeight:'900',letterSpacing:1.1},input:{height:57,borderRadius:radius.md,borderColor:color.border,borderWidth:1,backgroundColor:color.canvasRaised,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:15},field:{flex:1,color:color.text,fontSize:15,outlineStyle:'none' as never},options:{gap:10,paddingVertical:4},checkRow:{flexDirection:'row',alignItems:'center',gap:10,minHeight:28},checkbox:{width:21,height:21,borderRadius:7,borderWidth:1,borderColor:color.border,backgroundColor:color.canvasRaised,alignItems:'center',justifyContent:'center'},checkboxOn:{backgroundColor:color.success,borderColor:color.success},checkLabel:{color:color.textSecondary,fontSize:13,fontWeight:'700'},magic:{color:color.primaryBright,textAlign:'center',fontWeight:'800',fontSize:12,paddingVertical:6},switch:{color:color.textSecondary,textAlign:'center',fontWeight:'800',fontSize:12,paddingVertical:6},trust:{flexDirection:'row',alignItems:'flex-start',justifyContent:'center',gap:8,paddingHorizontal:8},trustText:{...type.caption,color:color.textMuted,flex:1,lineHeight:18},preview:{color:color.textMuted,textAlign:'center',fontSize:12,fontWeight:'700',paddingTop:4}});
