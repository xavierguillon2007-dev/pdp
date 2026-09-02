# Le Journal — site Supabase

## 1. Configuration
Ouvre `config.js` et remplace :
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

par les valeurs de ton projet Supabase.

## 2. Base de données
Dans Supabase > SQL Editor, colle tout le contenu de `supabase.sql` et exécute-le.

Puis utilise `signup.html` pour créer les comptes directement depuis le site. Le compte peut ensuite être ajouté comme administrateur via son UUID dans `admin_users`.

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


## 6. Création de compte et confirmation e-mail
Le formulaire `signup.html` utilise Supabase Auth. Si la confirmation d’e-mail est activée dans Supabase, le membre reçoit un e-mail et doit confirmer son adresse avant de se connecter. Dans Supabase > Authentication > URL Configuration, ajoute l’URL de ton site (et éventuellement l’URL de redirection `.../login.html`).

## 7. Clé API
Pour un site web, utilise la Publishable key (`sb_publishable_...`). Ne mets jamais une Secret key (`sb_secret_...`) ou une clé `service_role` dans le code du site.
