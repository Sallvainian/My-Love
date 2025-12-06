drop extension if exists "pg_net";

drop policy "Users can insert own interactions" on "public"."interactions";

drop policy "Users can view own interactions" on "public"."interactions";

drop policy "Users can delete own notes" on "public"."love_notes";

drop policy "Users can insert own notes" on "public"."love_notes";

drop policy "Users can view own notes" on "public"."love_notes";

drop policy "Partners can view partner moods" on "public"."moods";

drop policy "Users can view own moods" on "public"."moods";

drop policy "Users can insert own requests" on "public"."partner_requests";

drop policy "Users can view own requests" on "public"."partner_requests";

drop policy "Partners can view each other" on "public"."users";

drop policy "Users can update own profile" on "public"."users";

drop policy "Users can view own profile" on "public"."users";

drop policy "Users can update received interactions" on "public"."interactions";

drop policy "Users can delete own moods" on "public"."moods";

drop policy "Users can insert own moods" on "public"."moods";

drop policy "Users can update own moods" on "public"."moods";

drop policy "Users can update received requests" on "public"."partner_requests";

drop policy "Users can insert own profile" on "public"."users";

alter table "public"."love_notes" drop constraint "love_notes_content_check";

alter table "public"."moods" drop constraint "moods_note_check";

alter table "public"."moods" drop constraint "moods_user_id_fkey";

drop function if exists "public"."get_partner_id"(user_id uuid);

drop index if exists "public"."idx_interactions_users";

drop index if exists "public"."idx_love_notes_users_created";

drop index if exists "public"."idx_partner_requests_users";

alter table "public"."interactions" alter column "type" set data type text using "type"::text;

alter table "public"."moods" alter column "mood_type" set data type text using "mood_type"::text;

alter table "public"."moods" alter column "mood_types" set data type text[] using "mood_types"::text[];

alter table "public"."partner_requests" alter column "status" set default 'pending'::text;

alter table "public"."partner_requests" alter column "status" set data type text using "status"::text;

alter table "public"."users" alter column "device_id" set default gen_random_uuid();

drop type "public"."interaction_type";

drop type "public"."mood_type";

drop type "public"."partner_request_status";

CREATE INDEX idx_interactions_from_user ON public.interactions USING btree (from_user_id);

CREATE INDEX idx_interactions_to_user_viewed ON public.interactions USING btree (to_user_id, viewed);

CREATE INDEX idx_love_notes_from_user_created ON public.love_notes USING btree (from_user_id, created_at DESC);

CREATE INDEX idx_love_notes_to_user_created ON public.love_notes USING btree (to_user_id, created_at DESC);

CREATE INDEX idx_partner_requests_to_user_pending ON public.partner_requests USING btree (to_user_id, status);

CREATE UNIQUE INDEX idx_partner_requests_unique ON public.partner_requests USING btree (from_user_id, to_user_id) WHERE (status = 'pending'::text);

CREATE INDEX idx_users_display_name_search ON public.users USING btree (lower(display_name));

CREATE INDEX idx_users_email_search ON public.users USING btree (lower(email));

CREATE INDEX idx_users_partner ON public.users USING btree (partner_id);

alter table "public"."interactions" add constraint "interactions_type_check" CHECK ((type = ANY (ARRAY['poke'::text, 'kiss'::text]))) not valid;

alter table "public"."interactions" validate constraint "interactions_type_check";

alter table "public"."love_notes" add constraint "different_users" CHECK ((from_user_id <> to_user_id)) not valid;

alter table "public"."love_notes" validate constraint "different_users";

alter table "public"."moods" add constraint "moods_mood_type_check" CHECK ((mood_type = ANY (ARRAY['loved'::text, 'happy'::text, 'content'::text, 'excited'::text, 'thoughtful'::text, 'grateful'::text, 'sad'::text, 'anxious'::text, 'frustrated'::text, 'angry'::text, 'lonely'::text, 'tired'::text]))) not valid;

alter table "public"."moods" validate constraint "moods_mood_type_check";

alter table "public"."moods" add constraint "moods_mood_types_values_check" CHECK (((mood_types IS NULL) OR (mood_types <@ ARRAY['loved'::text, 'happy'::text, 'content'::text, 'excited'::text, 'thoughtful'::text, 'grateful'::text, 'sad'::text, 'anxious'::text, 'frustrated'::text, 'angry'::text, 'lonely'::text, 'tired'::text]))) not valid;

alter table "public"."moods" validate constraint "moods_mood_types_values_check";

alter table "public"."partner_requests" add constraint "no_self_requests" CHECK ((from_user_id <> to_user_id)) not valid;

alter table "public"."partner_requests" validate constraint "no_self_requests";

alter table "public"."partner_requests" add constraint "partner_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]))) not valid;

alter table "public"."partner_requests" validate constraint "partner_requests_status_check";

alter table "public"."love_notes" add constraint "love_notes_content_check" CHECK (((char_length(content) <= 1000) AND (char_length(content) >= 1))) not valid;

alter table "public"."love_notes" validate constraint "love_notes_content_check";

alter table "public"."moods" add constraint "moods_note_check" CHECK ((char_length(note) <= 500)) not valid;

alter table "public"."moods" validate constraint "moods_note_check";

alter table "public"."moods" add constraint "moods_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."moods" validate constraint "moods_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.decline_partner_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  DECLARE
    v_to_user_id UUID;
  BEGIN
    SELECT to_user_id
    INTO v_to_user_id
    FROM partner_requests
    WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Partner request not found or already processed';
    END IF;

    IF auth.uid() != v_to_user_id THEN
      RAISE EXCEPTION 'Only the recipient can decline a partner request';
    END IF;

    UPDATE partner_requests
    SET status = 'declined', updated_at = now()
    WHERE id = p_request_id;
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.sync_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  INSERT INTO public.users (id, email, display_name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, 'Unknown'), NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.accept_partner_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  DECLARE
    v_from_user_id UUID;
    v_to_user_id UUID;
    v_request_status TEXT;
  BEGIN
    SELECT from_user_id, to_user_id, status
    INTO v_from_user_id, v_to_user_id, v_request_status
    FROM partner_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Partner request not found';
    END IF;

    IF v_request_status != 'pending' THEN
      RAISE EXCEPTION 'Partner request is not pending';
    END IF;

    IF auth.uid() != v_to_user_id THEN
      RAISE EXCEPTION 'Only the recipient can accept a partner request';
    END IF;

    IF EXISTS (
      SELECT 1 FROM users
      WHERE id IN (v_from_user_id, v_to_user_id)
      AND partner_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'One or both users already have a partner';
    END IF;

    UPDATE users SET partner_id = v_to_user_id, updated_at = now()
    WHERE id = v_from_user_id;

    UPDATE users SET partner_id = v_from_user_id, updated_at = now()
    WHERE id = v_to_user_id;

    UPDATE partner_requests
    SET status = 'accepted', updated_at = now()
    WHERE id = p_request_id;

    UPDATE partner_requests
    SET status = 'declined', updated_at = now()
    WHERE id != p_request_id
      AND status = 'pending'
      AND (from_user_id IN (v_from_user_id, v_to_user_id)
           OR to_user_id IN (v_from_user_id, v_to_user_id));
  END;
  $function$
;


  create policy "Users can insert interactions"
  on "public"."interactions"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = from_user_id));



  create policy "Users can view interactions to/from them"
  on "public"."interactions"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = from_user_id) OR (( SELECT auth.uid() AS uid) = to_user_id)));



  create policy "Users can insert their own messages"
  on "public"."love_notes"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = from_user_id));



  create policy "Users can view their own messages"
  on "public"."love_notes"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = from_user_id) OR (( SELECT auth.uid() AS uid) = to_user_id)));



  create policy "Users can view own and partner moods"
  on "public"."moods"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = user_id) OR (( SELECT auth.uid() AS uid) IN ( SELECT users.partner_id
   FROM public.users
  WHERE ((users.id = moods.user_id) AND (users.partner_id IS NOT NULL))
UNION
 SELECT users.id
   FROM public.users
  WHERE ((users.partner_id = moods.user_id) AND (users.partner_id IS NOT NULL))))));



  create policy "Users can create partner requests"
  on "public"."partner_requests"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = from_user_id));



  create policy "Users can view their requests"
  on "public"."partner_requests"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = from_user_id) OR (( SELECT auth.uid() AS uid) = to_user_id)));



  create policy "Authenticated users can read all users"
  on "public"."users"
  as permissive
  for select
  to authenticated
using (true);



  create policy "users_update_self"
  on "public"."users"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = id))
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "Users can update received interactions"
  on "public"."interactions"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = to_user_id));



  create policy "Users can delete own moods"
  on "public"."moods"
  as permissive
  for delete
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can insert own moods"
  on "public"."moods"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can update own moods"
  on "public"."moods"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can update received requests"
  on "public"."partner_requests"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = to_user_id));



  create policy "Users can insert own profile"
  on "public"."users"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = id));


CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();


