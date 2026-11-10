'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WorkspaceShell from '@/components/shell/WorkspaceShell';
import { useAuth } from '@/components/shell/AuthProvider';
function Guard({children}:{children:React.ReactNode}){const {user,loading,session}=useAuth();const router=useRouter();useEffect(()=>{if(!loading&&!user)router.replace('/login');},[loading,user,router]);if(loading||!session)return <div className="grid min-h-screen place-items-center bg-[#0a0a0c] text-sm text-zinc-500">Verifying your secure session…</div>;return <WorkspaceShell>{children}</WorkspaceShell>;}
export default function Layout({children}:{children:React.ReactNode}){return <Guard>{children}</Guard>;}
