import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { color, elevation, radius, space, type } from '@/design';

export function PrimaryButton({ label, icon='arrow-forward', onPress, busy=false, disabled=false }: { label:string; icon?:keyof typeof Ionicons.glyphMap; onPress:()=>void; busy?:boolean; disabled?:boolean }) {
  return <Pressable disabled={disabled||busy} onPress={()=>{Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);onPress();}} style={({pressed})=>[s.primary,(pressed||disabled)&&s.pressed]}>{busy?<ActivityIndicator color="#fff"/>:<><Text style={s.primaryText}>{label}</Text><Ionicons name={icon} size={19} color="#fff"/></>}</Pressable>;
}
export function Surface({children,style,tone='default'}:PropsWithChildren<{style?:StyleProp<ViewStyle>;tone?:'default'|'raised'|'floating'}>){return <View style={[s.surface,tone==='raised'&&s.raised,tone==='floating'&&s.floating,style]}>{children}</View>}
export function ScreenHeader({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle?:string}){return <View><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.title}>{title}</Text>{subtitle?<Text style={s.subtitle}>{subtitle}</Text>:null}</View>}
export function Skeleton({width='100%',height=16,style}:{width?:number|string;height?:number;style?:StyleProp<ViewStyle>}){return <View style={[s.skeleton,{width:width as any,height},style]}/>}
const s=StyleSheet.create({primary:{height:58,borderRadius:radius.md,backgroundColor:color.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:space.xs,...elevation.raised},primaryText:{color:'#fff',fontWeight:'900',fontSize:15},pressed:{opacity:.76,transform:[{scale:.985}]},surface:{backgroundColor:color.surface,borderRadius:radius.xl,borderWidth:1,borderColor:color.border,padding:space.lg},raised:{backgroundColor:color.surfaceRaised,...elevation.raised},floating:{backgroundColor:color.surfaceFloating,...elevation.floating},eyebrow:{...type.label,color:color.primaryBright,marginBottom:space.sm},title:{...type.display,color:color.text},subtitle:{...type.body,color:color.textSecondary,marginTop:space.sm},skeleton:{borderRadius:radius.sm,backgroundColor:color.surfaceRaised,opacity:.8}});
