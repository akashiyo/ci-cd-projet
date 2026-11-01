# Book Catalog CI/CD

Projet ESGI de catalogue de livres avec React, Express, PostgreSQL et une chaîne
CI/CD Jenkins complète. Le pipeline construit, teste, analyse, publie et déploie
les mêmes images versionnées en staging puis en production blue/green.

## Accès locaux

| Service | URL | Rôle |
| --- | --- | --- |
| Frontend | http://localhost:3000 | Catalogue local |
| Backend | http://localhost:5000/books | API locale |
| Staging frontend | http://localhost:3001 | Frontend staging |
| Staging backend | http://localhost:5001 | API staging |
| Production proxy | http://localhost:8088 | Trafic blue/green |
| Jenkins | http://localhost:8080 | CI/CD |
| SonarQube | http://localhost:9000 | Analyse statique |
| Nexus UI | http://localhost:8081 | Dépôt d'artefacts |
| Nexus Docker Registry | http://localhost:8082 | Images Docker |
| Prometheus | http://localhost:9090 | Métriques |
| Grafana | http://localhost:3002 | Dashboard DORA |

## Identifiants locaux actuels

Ces valeurs sont conservées ici pour la démonstration locale.

```text
Nexus : admin / Cadavre38$
SonarQube : admin / Constitution38$
Jenkins : admin / Constitution38$
```

Le mot de passe initial Jenkins peut être lu avec :

```bash
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

## Architecture

- Frontend React 18/Create React App servi par Nginx.
- Backend Node.js/Express avec les routes `/books`, `/books/:id/comments` et
  `/api/health`.
- PostgreSQL 15 avec les tables `books` et `comments` initialisées au démarrage.
- Jenkins controller sans exécuteur et agent entrant `docker-agent` dédié.
- SonarQube pour l'analyse JavaScript et la couverture LCOV.
- Nexus avec le dépôt Docker hosted `docker-hosted` sur le port `8082`.
- Prometheus, Grafana et le collecteur DORA avec volumes persistants.

Les Dockerfiles utilisent la racine du dépôt comme contexte. Compose doit donc
conserver `context: .` et référencer chaque Dockerfile avec son chemin complet.

## Démarrage

Prérequis : Docker Compose v2, Node.js 18+, npm et suffisamment de mémoire pour
Jenkins, SonarQube, Nexus, PostgreSQL et Grafana.

Sous Linux, préparer SonarQube si nécessaire :

```bash
sudo sysctl -w vm.max_map_count=262144
```

Configurer `JENKINS_SECRET` dans `.env`, puis démarrer :

```bash
docker compose up -d --build
docker compose ps
```

Le mot de passe Grafana peut être défini avec `GRAFANA_ADMIN_PASSWORD`. La
valeur locale par défaut est `admin` et l'accès anonyme en lecture permet de
consulter le dashboard DORA.

Arrêt sans supprimer les données :

```bash
docker compose down
```

Suppression complète des volumes :

```bash
docker compose down -v
```

## Application et tests

Installation et qualité backend :

```bash
cd backend
npm install
npm run lint
npm test
npm run test:junit
```

Installation et qualité frontend :

```bash
cd frontend
npm install
npm run lint
npm test
npm run build
```

Tests ciblés :

```bash
cd backend && npx jest tests/app.test.js -t "should get books"
cd ../frontend && CI=true npx react-scripts test --watchAll=false -t "filters books by author"
```

Tests d'intégration PostgreSQL/backend :

```bash
bash tests/integration.sh
```

Le script utilise un projet Compose isolé, attend `/api/health`, vérifie `/books`
et nettoie ses conteneurs avec un `trap`. Les rapports JUnit sont écrits dans
`backend/reports/junit.xml` et `frontend/reports/junit.xml`. Les seuils de
couverture sont définis dans les deux projets npm.

## Pipeline Jenkins

Le `Jenkinsfile` déclaratif exécute sur `docker-agent` :

1. lint, tests, couverture et JUnit frontend/backend en parallèle ;
2. validation Conventional Commits avec commitlint ;
3. tests d'intégration Docker Compose ;
4. analyse SonarQube et attente du Quality Gate bloquant ;
5. construction unique des images backend, frontend et proxy avec le tag
   `${BUILD_NUMBER}-${sha12}` ;
6. publication dans Nexus ;
7. déploiement automatique en staging depuis `main` ;
8. contrôle `/api/health` de staging ;
9. approbation manuelle avec `submitter: 'admin'` ;
10. déploiement blue/green en production ;
11. release semantic-release sur `main`.

Le déploiement staging utilise toujours le projet Compose `ci-cd-projet` et les
services image-only `staging-backend` et `staging-frontend`. Cela évite de
recréer Jenkins, Nexus ou SonarQube depuis le workspace Multibranch.

### Configuration Jenkins requise

Créer les outils et credentials suivants :

- installation NodeJS nommée `node` ;
- installation SonarQube Scanner nommée `sonar-scanner` ;
- serveur SonarQube nommé `SonarQube` ;
- credential Docker `docker-registry-creds` ;
- credential Secret text `github-token` pour semantic-release et GitHub Branch
  Source.

Le projet SonarQube utilise le gate personnalisé `Book Catalog Gate`. Il impose
zéro nouvelle violation, zéro duplication significative et une couverture du
nouveau code d'au moins `50%`, alignée sur le seuil de lignes Jest du projet.
Le Jenkinsfile fusionne les rapports LCOV backend/frontend avec les chemins
racine attendus par SonarQube avant l'analyse.

La Shared Library `book-catalog-shared` est déclarée automatiquement par
`jenkins/init.groovy.d/configure-shared-library.groovy` et chargée en version
`v1.0.0` par le Jenkinsfile. Le tag `v1.0.0` doit exister sur GitHub.

La définition Job DSL est dans
`jenkins/job-dsl/book-catalog-multibranch.groovy`. Elle crée le job
`book-catalog-multibranch`, découvre les branches et les Pull Requests, et
utilise `Jenkinsfile` dans chaque branche. La procédure complète est documentée
dans `jenkins/job-dsl/README.md`.

Webhook GitHub :

```text
http://<adresse-accessible-de-jenkins>/github-webhook/
```

GitHub ne peut pas appeler `localhost`; un tunnel public est nécessaire pour
une démonstration locale.

## Staging et production blue/green

Staging utilise les ports `3001` et `5001`. Production possède deux couleurs :

- blue : frontend `3010`, backend `5010` ;
- green : frontend `3011`, backend `5011` ;
- proxy actif : `8088`.

Le script `scripts/deploy-production.sh` détecte la couleur active, déploie les
images Nexus sur l'autre couleur, vérifie l'API et le frontend, bascule le proxy
et restaure l'ancienne configuration en cas d'échec.

Test local avec des images déjà présentes :

```bash
SKIP_PULL=1 \
IMAGE_BACKEND=book-catalog-backend:local \
IMAGE_FRONTEND=book-catalog-frontend:local \
IMAGE_PROXY=book-catalog-proxy:local \
bash scripts/deploy-production.sh
```

Limite documentée : staging, production, PostgreSQL, Jenkins, SonarQube et
Nexus tournent sur le même hôte Docker et utilisent la même base PostgreSQL.

## Releases

Les commits suivent Conventional Commits, contrôlés par commitlint. Sur `main`,
semantic-release :

- calcule la prochaine version ;
- génère `CHANGELOG.md` ;
- crée le tag `vX.Y.Z` et la release GitHub ;
- écrit `release-version.txt` ;
- retague les images Nexus backend, frontend et proxy avec `X.Y.Z`.

Vérification locale :

```bash
npm ci
npm run release:dry-run
```

## Observabilité DORA

Le collecteur reçoit les événements Jenkins et les conserve dans le volume
`dora_events`. Prometheus scrape `dora-collector:9100`; Grafana provisionne le
dashboard `CI/CD / DORA metrics`.

Les quatre métriques utilisent des événements réels :

- fréquence de déploiement : déploiements production réussis sur 24 heures ;
- lead time : secondes entre le timestamp du commit et le déploiement production ;
- taux d'échec : pipelines Jenkins échoués / pipelines enregistrés ;
- temps de restauration : temps entre un pipeline échoué et le déploiement
  production réussi suivant.

Les événements de monitoring sont non bloquants pour la livraison. La collecte
depuis un build Jenkins réel doit encore être vérifiée après création du tag et
configuration du Multibranch.
