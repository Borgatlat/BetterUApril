-- Create function to delete user account and all associated data
create or replace function delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  -- Resolve the currently authenticated user.
  target_user_id := auth.uid();

  if target_user_id is null then
    raise exception 'delete_user_account must be called with an authenticated user';
  end if;

  -- Remove dependent records that reference the user id.
  delete from calorie_tracking where profile_id = target_user_id;
  delete from water_tracking where profile_id = target_user_id;
  delete from workout_kudos where workout_kudos.user_id = target_user_id;
  delete from mental_kudos where mental_kudos.user_id = target_user_id;
  delete from run_kudos where run_kudos.user_id = target_user_id;
  delete from friendships where friendships.user_id = target_user_id or friendships.friend_id = target_user_id;
  delete from personal_record_history
    where pr_id in (
      select id from personal_records where personal_records.user_id = target_user_id
    );
  delete from personal_records where personal_records.user_id = target_user_id;

  -- Remove profile row (stored with id = user uuid for this project).
  delete from profiles where profiles.id = target_user_id;

  -- Finally delete the auth user itself.
  delete from auth.users where id = target_user_id;
end;
$$; 