-- Formularul "Adauga exercitiu" ofera raritatea Legendar, dar tabelul custom_exercises accepta doar
-- usor, mediu si dificil (Comun, Rar, Epic): un exercitiu Legendar era refuzat la salvare.
-- Se adauga 'legendar' la lista permisa. Nimic existent nu se schimba (cele 22 de exercitii sunt toate in lista veche).
-- Clasa a 9-a nu cere nicio alta schimbare: category_id si subcategory_id sunt text liber (ex1 ... ex12), grade '9' e deja permis.

alter table public.custom_exercises drop constraint if exists custom_exercises_difficulty_check;
alter table public.custom_exercises
  add constraint custom_exercises_difficulty_check check (difficulty in ('usor', 'mediu', 'dificil', 'legendar'));

-- Verificare (trebuie sa arate cele patru valori):
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'custom_exercises_difficulty_check';
