-- Drop production-only drift: objects the hosted project has that no
-- migration in this repo creates and nothing in the app, the tests or the
-- one edge function (upload-love-note-image) uses.
--
--   public.get_random_daily_message(text)  SECURITY DEFINER
--   public.daily_love_messages             generic seed rows, read-only
--   public.notifications                   empty
--   public.push_subscriptions              empty
--
-- None of them exists on a local or CI stack built from these migrations, so
-- every statement here is a no-op there. No view or rule depends on the
-- tables. The function goes first, then the tables, with no CASCADE: an
-- unexpected dependant makes the drop fail rather than silently taking
-- something else with it.

begin;

drop function if exists public.get_random_daily_message(text);

drop table if exists public.daily_love_messages;
drop table if exists public.notifications;
drop table if exists public.push_subscriptions;

commit;
