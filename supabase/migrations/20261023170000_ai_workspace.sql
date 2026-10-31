-- OmniScale AI Workspace: user-owned conversations and messages.
-- Apply in Supabase SQL Editor or through your existing migration workflow.
-- The backend service-role client bypasses RLS, so backend queries MUST continue
-- to filter by authenticated req.user.id (as aiWorkspace.js does).

create extension if not exists pgcrypto;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation'
    check (char_length(title) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_id_user_id_unique unique (id, user_id)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  constraint ai_messages_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references public.ai_conversations(id, user_id)
    on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 30000),
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);

create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at asc);

create index if not exists ai_messages_user_idx
  on public.ai_messages (user_id);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "Users can read own AI conversations" on public.ai_conversations;
create policy "Users can read own AI conversations"
  on public.ai_conversations for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own AI conversations" on public.ai_conversations;
create policy "Users can insert own AI conversations"
  on public.ai_conversations for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own AI conversations" on public.ai_conversations;
create policy "Users can update own AI conversations"
  on public.ai_conversations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own AI conversations" on public.ai_conversations;
create policy "Users can delete own AI conversations"
  on public.ai_conversations for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own AI messages" on public.ai_messages;
create policy "Users can read own AI messages"
  on public.ai_messages for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own AI messages" on public.ai_messages;
create policy "Users can insert own AI messages"
  on public.ai_messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own AI messages" on public.ai_messages;
create policy "Users can delete own AI messages"
  on public.ai_messages for delete to authenticated
  using (auth.uid() = user_id);
