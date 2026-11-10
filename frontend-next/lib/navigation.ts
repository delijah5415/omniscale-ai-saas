import { Bot, BookOpen, CalendarClock, Code2, LayoutDashboard, Library, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
export const navigation = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'New chat', href: '/workspace', icon: Sparkles, group: 'Workspace' },
  { label: 'Platform builder', href: '/builder', icon: Code2, group: 'Create' },
  { label: 'Automations', href: '/automations', icon: Bot, group: 'Create' },
  { label: 'Library', href: '/library', icon: Library, group: 'Organize' },
  { label: 'Notebooks', href: '/notebooks', icon: BookOpen, group: 'Organize' },
  { label: 'Scheduled tasks', href: '/scheduled-tasks', icon: CalendarClock, group: 'Organize' },
  { label: 'Settings', href: '/settings/account', icon: Settings2, group: 'Manage' },
  { label: 'Subscription', href: '/subscribe', icon: ShieldCheck, group: 'Manage' }
];
export const settingsNav = [
  { label: 'Account & profile', href: '/settings/account' },
  { label: 'Subscription', href: '/settings/subscription' },
  { label: 'Usage', href: '/settings/usage' },
  { label: 'Preferences', href: '/settings/preferences' },
  { label: 'Privacy & data', href: '/settings/privacy' }
];
