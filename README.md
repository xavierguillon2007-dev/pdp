# Le Journal — site Supabase

## 1. Configuration
Ouvre `config.js` et remplace :
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

par les valeurs de ton projet Supabase.

## 2. Base de données
Dans Supabase > SQL Editor, colle tout le contenu de `supabase.sql` et exécute-le.

Puis crée un compte dans Supabase > Authentication > Users (ou via ton futur formulaire de création de compte).

Ajoute ce compte comme administrateur avec :
```sql
insert into public.admin_users(user_id)
values ('UUID_DU_COMPTE');
```

## 3. Images
Le site utilise Supabase Storage, bucket `journal`.
L'admin peut sélectionner une image depuis son ordinateur : elle est envoyée dans le bucket et le site en utilise ensuite le fichier stocké dans Supabase. Aucune URL d'image externe n'est nécessaire.

## 4. YouTube
Dans l'administration, colle une URL YouTube dans "Vidéo YouTube". Le site transforme automatiquement les URL youtube.com/watch?v=... et youtu.be/... en lecteur intégré.

## 5. Hébergement
Le projet est un site statique : il peut être hébergé sur Vercel, Netlify, GitHub Pages, ou un hébergement web classique.
