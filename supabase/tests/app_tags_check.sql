-- Auto app tags: inserts a throwaway ticket, shows its tags, then rolls back.
BEGIN;
INSERT INTO public.tickets (id, organization_id, client_access_token, client_full_name, email, company_name, issue_title, issue_description, issue_category, priority)
SELECT '00000000-0000-4000-8000-0000000000aa', id, 'tagcheck-token-000000000000000000', 'Tag Check', 'tag@example.com', '-',
       'Contract Workspace: cannot unlock', 'Also asked about TaxPractice login', 'Other', 'Low (minor issue or general inquiry)'
FROM public.organizations WHERE name = 'Higher View Legacy';
SELECT g.name FROM public.ticket_tags tt JOIN public.tags g ON g.id = tt.tag_id
WHERE tt.ticket_id = '00000000-0000-4000-8000-0000000000aa' ORDER BY g.name;
ROLLBACK;
