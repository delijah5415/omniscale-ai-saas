'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { API_URL } from '@/lib/config';
type AuthState = { user: User | null; session: Session | null; loading: boolean; subscription: any; refreshSubscription: () => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,setUser]=useState<User|null>(null); const [session,setSession]=useState<Session|null>(null); const [loading,setLoading]=useState(true); const [subscription,setSubscription]=useState<any>(null); const verifying=useRef(false);
  const refreshSubscription=useCallback(async()=>{ if(!session?.access_token){setSubscription(null);return;} try { const r=await fetch(`${API_URL}/builder/subscription-status`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||'Unable to verify subscription'); setSubscription(d); } catch(e:any){setSubscription({status:'unknown',hasAccess:false,error:e.message});} },[session?.access_token]);
  useEffect(()=>{ let mounted=true; let subscriptionListener: {unsubscribe:()=>void}|undefined; try { const supabase=getSupabase(); supabase.auth.getSession().then(({data})=>{if(!mounted)return;setSession(data.session);setUser(data.session?.user??null);setLoading(false);}).catch(()=>mounted&&setLoading(false)); const {data}=supabase.auth.onAuthStateChange((_event,next)=>{if(!mounted)return;setSession(next);setUser(next?.user??null);setLoading(false);}); subscriptionListener=data.subscription; } catch { setLoading(false); } return ()=>{mounted=false;subscriptionListener?.unsubscribe();}; },[]);
  useEffect(()=>{void refreshSubscription();},[refreshSubscription]);
  useEffect(()=>{ const id=new URLSearchParams(window.location.search).get('subscription_id'); const token=session?.access_token; if(!id||!token||verifying.current)return; verifying.current=true; fetch(`${API_URL}/builder/verify-subscription`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({subscriptionId:id})}).then(async r=>{const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'PayPal subscription verification failed');window.history.replaceState({},document.title,window.location.pathname);await refreshSubscription();}).catch(e=>{console.error('PayPal subscription verification:',e.message);}).finally(()=>{verifying.current=false;}); },[session?.access_token,refreshSubscription]);
  const signOut=useCallback(async()=>{await getSupabase().auth.signOut();setSession(null);setUser(null);setSubscription(null);},[]);
  const value=useMemo(()=>({user,session,loading,subscription,refreshSubscription,signOut}),[user,session,loading,subscription,refreshSubscription,signOut]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value;}
