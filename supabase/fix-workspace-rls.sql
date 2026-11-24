do $$
begin
  raise exception 'This helper is retired because it disabled tenant row-level security.'
    using hint = 'Run supabase/schema.sql to apply the current secure policies and company registration function.';
end
$$;
