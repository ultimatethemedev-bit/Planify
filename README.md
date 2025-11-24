# 🚀 Planify

Application de gestion de planning pour boutiques retail.

## 📋 Features

- ✅ Authentification manager (login/register)
- ✅ CRUD Employés (nom, prénom, contrat, téléphone, email, couleur)
- ✅ Configuration horaires boutique par jour
- ✅ Création planning hebdomadaire avec cards colorées
- ✅ Modal de saisie des horaires avec templates
- ✅ Alertes légales automatiques (10h/jour, 48h/semaine, repos 24h, etc.)
- ✅ Événements commerciaux (Black Friday, Soldes, etc.)
- 🔜 Duplication planning
- 🔜 Export PDF
- 🔜 Envoi par email

## 🛠️ Stack Technique

### Frontend
- React 18 + Vite
- TailwindCSS
- Zustand (state management)
- React Router
- React Hook Form
- @iconify/react (icônes Solar)
- date-fns

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT Auth
- Nodemailer (Brevo)

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone <repo-url>
cd planify
```

### 2. Installer les dépendances

```bash
# Installer toutes les dépendances
npm run install:all
```

### 3. Configuration

Créer un fichier `.env` dans `/server` :

```bash
cp server/.env.example server/.env
```

Modifier les variables d'environnement :

```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/planify
JWT_SECRET=votre-secret-jwt-super-securise
JWT_EXPIRES_IN=7d
```

### 4. Lancer en développement

```bash
# Lancer client + server simultanément
npm run dev

# Ou séparément :
npm run dev:client  # Frontend sur http://localhost:5173
npm run dev:server  # Backend sur http://localhost:3001
```

## 📁 Structure

```
planify/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/    # Header, Layout, BottomNav
│   │   │   ├── planning/  # ShiftHoursModal
│   │   │   └── employees/ # AddEmployeeModal
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Planning.tsx
│   │   │   ├── Employees.tsx
│   │   │   └── Settings.tsx
│   │   ├── stores/        # Zustand stores
│   │   ├── services/      # API calls
│   │   └── utils/         # Helpers, calculs planning
│   └── ...
│
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── models/        # User, Employee, Planning, Settings
│   │   ├── routes/        # auth, employees, planning, settings
│   │   ├── middleware/    # auth JWT
│   │   └── server.js
│   └── ...
│
└── package.json           # Scripts monorepo
```

## 🚢 Déploiement

### Frontend (Vercel)

1. Connecter le repo à Vercel
2. Root Directory: `client`
3. Build Command: `npm run build`
4. Output Directory: `dist`

### Backend (Railway)

1. Connecter le repo à Railway
2. Root Directory: `server`
3. Start Command: `npm start`
4. Variables d'environnement : copier `.env`

### Base de données (MongoDB Atlas)

1. Créer un cluster gratuit M0
2. Créer un utilisateur database
3. Whitelist IPs (0.0.0.0/0 pour Railway)
4. Copier la connection string dans `MONGODB_URI`

## 📜 Convention Collective

L'application intègre les alertes légales basées sur :
- **Code du Travail** : 10h/jour max, 48h/semaine max, 11h repos entre shifts, pause 20min après 6h
- **Convention Collective IDCC 733** (Détaillants chaussures) : Majoration 100% dimanche

## 🎨 Design System

- **Primary** : #3B82F6 (Bleu)
- **Font** : Inter
- **Icônes** : Solar (via Iconify)
- **Border Radius** : 0.5rem (rounded-lg)

---

Développé avec ❤️ pour simplifier la vie des managers retail.
