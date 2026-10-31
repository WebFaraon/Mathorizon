-- Verificare doar de citire, de rulat dupa migratia 20261031100000_securizare_date.sql si inainte de fiecare lansare.
-- Fiecare interogare trebuie sa dea ZERO randuri.

-- 1. Functii cu drepturi speciale (SECURITY DEFINER) pe care le poate apela cineva fara cont
select p.proname as functie_apelabila_fara_cont
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
  and has_function_privilege('anon', p.oid, 'execute');

-- 2. Tabele fara securitate pe randuri
select c.relname as tabel_fara_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;

-- 3. Tabele pe care anonimul poate scrie, sau pe care citeste fara sa fie publice
select c.relname as tabel_cu_drepturi_pentru_anonim
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete')
       or (has_table_privilege('anon', c.oid, 'select') and c.relname not in ('custom_exercises', 'training_mcq_cache')));

-- 4. Politici de scriere in storage deschise pentru oricine
select policyname as politica_storage_deschisa, cmd
from pg_policies
where schemaname = 'storage' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and roles::text ~ '(anon|public)';

-- 5. Politici pe tabele care lasa pe oricine sa citeasca (in afara de exercitiile publice)
select tablename, policyname
from pg_policies
where schemaname = 'public' and cmd in ('SELECT', 'ALL') and roles::text ~ '(anon|public)' and coalesce(qual, 'true') = 'true'
  and tablename not in ('custom_exercises', 'training_mcq_cache');
