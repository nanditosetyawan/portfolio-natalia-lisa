const fs = require('fs');
let body = fs.readFileSync('C:/Users/VivoBook/.gemini/antigravity-ide/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/.system_generated/steps/4554/output.txt', 'utf8');
const startIndex = body.indexOf('[{');
const endIndex = body.lastIndexOf('}]') + 2;
const data = JSON.parse(body.substring(startIndex, endIndex));
let prosrc = data[0].prosrc;

// Replace the UPDATE with DELETE
prosrc = prosrc.replace(
  /update public.site_revisions\s*set status = 'archived'\s*where status = 'published';/i,
  "delete from public.site_revisions\n  where status = 'published';"
);

// We need to bypass pg_safeupdate for DELETE without WHERE, but here we HAVE a WHERE clause (WHERE status = 'published'), so it's perfectly safe!

const fullSql = `
CREATE OR REPLACE FUNCTION public.publish_editor_draft(
  p_draft_id uuid,
  p_prepared_snapshot jsonb,
  p_expected_published_revision bigint,
  p_expected_draft_lock_version bigint,
  p_note text default null
)
RETURNS setof public.site_revisions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
${prosrc}
$$;
`;

fs.writeFileSync('scratch_update_publish.sql', fullSql);
console.log('Saved to scratch_update_publish.sql');
