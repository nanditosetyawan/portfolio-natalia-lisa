-- Keep the atomic Phase 038 Publish function aligned with the product-level
-- limit used by the Editor command and EditorSnapshot validators.
do $migration$
declare
  function_definition text;
  old_limit_clause constant text := 'having count(*) > 100';
  new_limit_clause constant text := 'having count(*) > 50';
  old_limit_message constant text := 'A section exceeds the maximum of 100 dynamic instances.';
  new_limit_message constant text := 'A section exceeds the maximum of 50 dynamic instances.';
begin
  select pg_get_functiondef(
    'public.publish_editor_draft(uuid,jsonb,bigint,bigint,text)'::regprocedure
  ) into function_definition;

  if position(new_limit_clause in function_definition) > 0 then
    return;
  end if;

  if position(old_limit_clause in function_definition) = 0
     or position(old_limit_message in function_definition) = 0 then
    raise exception 'publish_editor_draft does not contain the expected Phase 038 section limit.';
  end if;

  function_definition := replace(function_definition, old_limit_clause, new_limit_clause);
  function_definition := replace(function_definition, old_limit_message, new_limit_message);
  execute function_definition;
end;
$migration$;

alter function public.publish_editor_draft(uuid, jsonb, bigint, bigint, text)
  security invoker
  set search_path = '';

revoke execute on function public.publish_editor_draft(uuid, jsonb, bigint, bigint, text)
  from public, anon;
grant execute on function public.publish_editor_draft(uuid, jsonb, bigint, bigint, text)
  to authenticated;

notify pgrst, 'reload schema';
