<h1>Planify</h1>

**Faire le planning hebdomadaire d'une boutique, avec les règles du Code du travail dans l'outil.** Tu poses les horaires, l'app prévient quand un dépassement se prépare — pas après.

Les tableurs ne savent pas qu'un salarié ne peut pas enchaîner 10 heures et reprendre 9 heures plus tard. Les logiciels qui le savent coûtent un abonnement par salarié. C'est un entre-deux, à héberger soi-même.

---

## Les alertes

Cinq contrôles tournent en continu pendant que tu construis le planning :

| Alerte | Déclenchement |
|---|---|
| `daily_max` | Dépassement de la durée quotidienne maximale |
| `rest_between_days` | Moins de 11 h de repos entre deux journées |
| `weekly_max` | Dépassement de 48 h sur la semaine |
| `overtime` | Au-delà de 35 h — heures supplémentaires à prévoir (+25 %, puis +50 %) |
| `consecutive_days` | Trop de jours travaillés d'affilée sans repos hebdomadaire |

Chaque alerte affiche le calcul qui l'a déclenchée et **une suggestion de correction** — décaler une prise de poste pour retrouver les 11 heures, ajouter un jour de repos.

> ⚠️ **Ce sont des garde-fous, pas un avis juridique.** Les seuils implémentés sont ceux du régime général. Une convention collective peut être plus stricte (et beaucoup le sont dans le commerce). Fais valider les seuils par quelqu'un dont c'est le métier avant de t'y fier pour de vrai, et adapte-les dans `client/src/utils/legalAlerts.ts`.

---

## Ce que ça fait

- **Employés** — fiche par personne : contrat, coordonnées, couleur d'affichage
- **Boutique** — horaires d'ouverture jour par jour
- **Planning hebdomadaire** — cartes colorées par employé, saisie par modale, gabarits d'horaires réutilisables
- **Duplication** — recopier une semaine sur une autre
- **Export PDF** — le planning rendu en image puis mis en page
- **Envoi par email** — transmission aux employés (Resend)
- **Pointage** — suivi des heures réellement effectuées face au prévu
- **Événements commerciaux** — Black Friday, soldes : marqués sur la semaine pour anticiper le renfort
- **Équipe et rôles** — invitation de managers par code, rôles propriétaire / membre, retrait d'un membre
- **Comptes** — inscription, connexion, réinitialisation de mot de passe

---

## Lancer

Il te faut **Node 18+** et un **MongoDB** (local ou Atlas).

```bash
git clone https://github.com/ultimatethemedev-bit/planify.git
cd planify
npm run install:all

cp server/.env.example server/.env    # MONGODB_URI, JWT_SECRET, RESEND_API_KEY
cp client/.env.example client/.env

npm run dev        # client + serveur en parallèle
```

Le client tourne sur le port de Vite, l'API sur `3001`.

`RESEND_API_KEY` n'est nécessaire **que** pour l'envoi des plannings par email et la réinitialisation de mot de passe — le reste fonctionne sans.

---

## Stack

**Client** — React 18 · TypeScript · Vite · Zustand · React Router · React Hook Form · date-fns · jsPDF + html2canvas · Iconify

**Serveur** — Node · Express · TypeScript · MongoDB (Mongoose) · JWT (bcryptjs) · Resend · Pino

**Sécurité** — Helmet et CORS globaux, limitation de débit sur les routes d'authentification, validation des entrées et des ObjectId par `express-validator`.

**API documentée** — Swagger UI sur `/api/docs`, spec générée depuis les commentaires JSDoc des routes.

**Tests** — Jest côté serveur sur l'authentification et le planning.

---

## Structure

```
client/src/
  pages/            Planning, Employés, Réglages, Pointage
  components/
    planning/       grille, modales de saisie
    employees/
  utils/
    legalAlerts.ts  ← les 5 contrôles et leurs suggestions
  stores/           état Zustand (auth, employés, réglages)

server/src/
  routes/           auth · employees · planning · settings · stores (équipe) · timesheets · user
  utils/email.ts    envois Resend
  __tests__/        auth, planning
```

Le fichier à regarder en premier est `client/src/utils/legalAlerts.ts` : tout le métier est là, et il ne dépend de rien d'autre que des horaires passés en argument.

---

## Licence

MIT — voir [LICENSE](LICENSE).
