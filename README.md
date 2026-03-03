# Resume Reader

Projet complet pour l'analyse et l'explication de documents (CV, rapports, etc.) avec une interface web et une API backend.


## Structure détaillée du projet

```
resume reader/
├── backend/
│   ├── server.py                # API FastAPI principale, routes, logique d'analyse
│   ├── requirements.txt         # Dépendances Python du backend
│   ├── __pycache__/             # Fichiers de cache Python
│   └── ...                      # Autres fichiers backend (tests, config, etc.)
│
├── frontend/
│   ├── src/
│   │   ├── App.js               # Composant racine React
│   │   ├── App.css              # Styles globaux
│   │   ├── index.js             # Point d'entrée React
│   │   ├── index.css            # Styles globaux
│   │   ├── components/
│   │   │   ├── AnalysisResults.jsx      # Affichage des résultats d'analyse
│   │   │   ├── CameraScanner.jsx        # Scan de documents via caméra
│   │   │   ├── DocumentExplainer.jsx    # Explication de document
│   │   │   ├── FileUploader.jsx         # Upload de fichiers
│   │   │   ├── HistoryPanel.jsx         # Historique des analyses
│   │   │   └── ui/                      # Composants UI réutilisables (boutons, cartes, etc.)
│   │   ├── hooks/
│   │   │   └── use-toast.js             # Hook pour notifications/toasts
│   │   ├── lib/
│   │   │   └── utils.js                 # Fonctions utilitaires JS
│   ├── public/
│   │   └── index.html           # Template HTML principal
│   ├── package.json             # Dépendances et scripts JS
│   ├── tailwind.config.js       # Configuration Tailwind CSS
│   ├── craco.config.js          # Configuration CRACO (customisation build)
│   ├── jsconfig.json            # Configuration JS
│   ├── postcss.config.js        # Configuration PostCSS
│   ├── README.md                # Documentation frontend
│   └── plugins/                 # Plugins personnalisés (health-check, visual-edits)
│       ├── health-check/
│       │   ├── health-endpoints.js
│       │   └── webpack-health-plugin.js
│       └── visual-edits/
│           ├── babel-metadata-plugin.js
│           └── dev-server-setup.js
│
├── design_guidelines.json       # Directives de design UI/UX
├── backend_test.py              # Script de test backend
├── README.md                    # Documentation principale du projet
```

### Description des dossiers et fichiers principaux

- **backend/** : Contient toute la logique serveur, l’API FastAPI, la connexion à MongoDB, la gestion des analyses et explications de documents.
   - `server.py` : Point d’entrée de l’API, routes, modèles, helpers.
   - `requirements.txt` : Liste des dépendances Python nécessaires.
   - `__pycache__/` : Cache d’exécution Python (généré automatiquement).
   - Autres fichiers : tests, configuration, scripts additionnels.

- **frontend/** : Application React pour l’interface utilisateur.
   - `src/` : Code source React, composants, hooks, utilitaires.
   - `public/` : Fichiers statiques et template HTML.
   - `package.json` : Dépendances JS et scripts de build.
   - `tailwind.config.js` : Configuration Tailwind CSS.
   - `plugins/` : Plugins JS personnalisés pour la build ou la santé du projet.
   - Autres fichiers : configuration, documentation frontend.

- **design_guidelines.json** : Fichier de directives pour le design et l’ergonomie de l’interface.
- **backend_test.py** : Script de test pour le backend.
- **README.md** : Documentation principale du projet (ce fichier).

---

## Fonctionnalités principales

- **Backend FastAPI** :
  - Analyse de texte de CV/document (scoring, extraction de compétences, feedback)
  - Explication de document (résumé, points clés, type de document)
  - Stockage des analyses dans MongoDB
  - API RESTful (analyse, explication, historique, suppression)
  - Support IA locale (Ollama) ou fallback analyse basique

- **Frontend React** :
  - Interface utilisateur pour uploader, analyser et visualiser les résultats
  - Affichage des scores, feedbacks, points forts/faibles
  - Historique des analyses
  - UI moderne avec Tailwind CSS

## Installation

### Backend

1. Aller dans le dossier backend :
   ```
   cd backend
   ```
2. Installer les dépendances :
   ```
   pip install -r requirements.txt
   ```
3. Configurer le fichier `.env` avec :
   - MONGO_URL
   - DB_NAME
   - CORS_ORIGINS
4. Lancer le serveur :
   ```
   uvicorn server:app --reload
   ```

### Frontend

1. Aller dans le dossier frontend :
   ```
   cd frontend
   ```
2. Installer les dépendances :
   ```
   npm install
   ```
3. Lancer l'application :
   ```
   npm start
   ```

## Utilisation

- Accéder au frontend sur [http://localhost:3000](http://localhost:3000)
- L'API backend est disponible sur [http://localhost:8000/api](http://localhost:8000/api)

## Endpoints principaux (Backend)

- `POST /api/analyze/text` : Analyse un texte de CV/document
- `POST /api/explain` : Explication d'un document
- `GET /api/analyses` : Liste des analyses récentes
- `GET /api/analyses/{id}` : Détail d'une analyse
- `DELETE /api/analyses/{id}` : Supprime une analyse

## Technologies utilisées

- **Backend** : FastAPI, MongoDB, Motor, Python, Ollama (optionnel)
- **Frontend** : React, Tailwind CSS, JavaScript

## Bonnes pratiques

- Respecter la structure des dossiers
- Sécuriser les accès à la base de données
- Utiliser des variables d'environnement pour les secrets
- Documenter les composants et les endpoints

## Pour aller plus loin

- Ajouter l'authentification utilisateur
- Déployer sur le cloud (Vercel, Heroku, etc.)
- Intégrer d'autres modèles IA

## Déploiement sur Render

Le projet est prêt pour Render avec:

- un backend Docker dans [backend/Dockerfile](backend/Dockerfile) (inclut Tesseract + Poppler)
- une configuration Render centralisée dans [render.yaml](render.yaml)

### 1) Préparer le dépôt

1. Commit/push tes changements sur GitHub.
2. Vérifie que les fichiers existent:
   - [render.yaml](render.yaml)
   - [backend/Dockerfile](backend/Dockerfile)

### 2) Créer les services sur Render

1. Va sur Render → **New** → **Blueprint**.
2. Connecte ton repo GitHub.
3. Render détecte automatiquement [render.yaml](render.yaml) et propose 2 services:
   - `resume-reader-api` (backend FastAPI)
   - `resume-reader-frontend` (site statique React)
4. Lance la création.

### 3) Configurer les variables d'environnement

Dans le service backend `resume-reader-api`, ajoute:

- `MONGO_URL` = URI MongoDB Atlas
- `DB_NAME` = nom de ta base
- `CORS_ORIGINS` = URL frontend Render (ex: `https://resume-reader-frontend.onrender.com`)

`TESSERACT_CMD` est déjà défini à `/usr/bin/tesseract` dans [render.yaml](render.yaml).

Dans le service frontend `resume-reader-frontend`, ajoute:

- `REACT_APP_BACKEND_URL` = URL publique du backend (ex: `https://resume-reader-api.onrender.com`)

Puis **Redeploy** le frontend après avoir défini `REACT_APP_BACKEND_URL`.

### 4) Vérification après déploiement

1. Ouvre l'URL backend: `/api/health`
2. Ouvre le frontend et teste:
   - upload image
   - upload PDF
   - analyse historique

### 5) Points importants

- Le backend est en Docker pour garantir OCR (Tesseract/Poppler) en production.
- Pour un frontend React en mode static sur Render, la route SPA est gérée via rewrite `/* -> /index.html` dans [render.yaml](render.yaml).
- Si le frontend n'atteint pas l'API, vérifie d'abord `REACT_APP_BACKEND_URL` et `CORS_ORIGINS`.

---

# Documentation détaillée

## Backend

- **server.py** : Point d'entrée FastAPI, routes API, logique d'analyse et explication, gestion MongoDB
- **requirements.txt** : Dépendances Python
- **.env** : Variables d'environnement (non versionné)

## Frontend

- **src/** : Composants React, hooks, styles
- **public/** : Fichiers statiques
- **package.json** : Dépendances JS
- **tailwind.config.js** : Configuration Tailwind

## Fichiers racine

- **design_guidelines.json** : Directives de design UI/UX
- **backend_test.py** : Tests backend

## Auteur

Projet réalisé par Jokast KASSA.

---

Pour toute question, consultez la documentation de FastAPI et React ou contactez le mainteneur du projet.
