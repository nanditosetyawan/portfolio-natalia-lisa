-- Phase 029G: revision conflicts are application conflicts, not PostgreSQL
-- serialization failures. SQLSTATE 40001 is retryable and caused PostgREST to
-- retry an intentionally stale request until its upstream timeout. PT409 maps
-- directly to HTTP 409 without retrying the transaction.

do $migration$
declare
  routine_name text;
  routine_definition text;
begin
  foreach routine_name in array array[
    'public.save_editor_draft(uuid,jsonb,bigint,bigint,boolean)',
    'public.publish_editor_draft(uuid,jsonb,bigint,bigint,text)',
    'public.rollback_published_revision(uuid,bigint,text)'
  ] loop
    select pg_get_functiondef(to_regprocedure(routine_name))
      into routine_definition;

    if routine_definition is null then
      raise exception 'Required revision routine is missing: %', routine_name;
    end if;

    if position('40001' in routine_definition) = 0 then
      raise exception 'Expected retryable conflict code was not found in: %', routine_name;
    end if;

    execute replace(routine_definition, '40001', 'PT409');
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
