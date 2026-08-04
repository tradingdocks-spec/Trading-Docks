import { appStorage } from '@/services/storage/app-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type WorkSessionType = 'buying' | 'trade' | 'scan' | 'card-show';
export type WorkSession = { id: string; type: WorkSessionType; name: string; startedAt: string; itemCount: number; status: 'active' | 'paused' };
type SessionContextValue = { ready: boolean; activeSession: WorkSession | null; startSession: (type: WorkSessionType, name: string) => Promise<void>; pauseSession: () => Promise<void>; endSession: () => Promise<void> };
const KEY = 'td-active-session-v1';
const Context = createContext<SessionContextValue>({ ready: false, activeSession: null, startSession: async()=>{}, pauseSession: async()=>{}, endSession: async()=>{} });
export function SessionProvider({ children }: PropsWithChildren) {
  const [activeSession, setActive] = useState<WorkSession | null>(null); const [ready, setReady] = useState(false);
  useEffect(()=>{ appStorage.getItem(KEY).then(raw=>{ if(raw){ try{setActive(JSON.parse(raw));}catch{} } setReady(true); }); },[]);
  const persist=async(value:WorkSession|null)=>{setActive(value); if(value) await appStorage.setItem(KEY,JSON.stringify(value)); else await appStorage.removeItem(KEY);};
  const startSession=async(type:WorkSessionType,name:string)=>persist({id:String(Date.now()),type,name,startedAt:new Date().toISOString(),itemCount:0,status:'active'});
  const pauseSession=async()=>{if(activeSession) await persist({...activeSession,status:'paused'});};
  const endSession=async()=>persist(null);
  const value=useMemo(()=>({ready,activeSession,startSession,pauseSession,endSession}),[ready,activeSession]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useWorkSession=()=>useContext(Context);
