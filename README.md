# ci-cd-projet

- Frontend : http://localhost:3000
- Backend : http://localhost:5000/books
- Jenkins : http://localhost:8080
- SonarQube : http://localhost:9000
- Nexus : http://localhost:8081

password nexus: Cadavre38$

password sonarqube: Constitution38$

jenkins : admin | Constitution38$

docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword

docker compose --env-file /dev/null exec jenkins \
  cat /var/jenkins_home/secrets/initialAdminPassword

## Environnements

- Staging : frontend http://localhost:3001, backend http://localhost:5001
- Production blue/green (reverse proxy) : http://localhost:8088
  - blue : backend http://localhost:5010, frontend http://localhost:3010
  - green : backend http://localhost:5011, frontend http://localhost:3011

Le reverse proxy sert `/` depuis le frontend actif et `/api`, `/books` depuis le
backend actif. Le pipeline déploie l'image publiée dans Nexus sur l'instance
inactive, vérifie `/api/health`, puis bascule le proxy. L'ancienne instance reste
démarrée pour le rollback.

Test local du script de déploiement (images déjà présentes) :

```bash
SKIP_PULL=1 \
IMAGE_BACKEND=book-catalog-backend:local \
IMAGE_FRONTEND=book-catalog-frontend:local \
IMAGE_PROXY=book-catalog-proxy:local \
bash scripts/deploy-production.sh
```

Limite de la démonstration : staging, production et PostgreSQL partagent le même
hôte Docker et la même base de données.

## Releases

Les commits suivent Conventional Commits (voir `CONTRIBUTING.md`). Jenkins vérifie
les messages avec commitlint, puis le stage `Release` (branche `main`) exécute
semantic-release après le déploiement production :

- calcul automatique de la version ;
- génération de `CHANGELOG.md` ;
- tag Git `vX.Y.Z` et release GitHub ;
- images Nexus également taguées `X.Y.Z`
  (`book-catalog-{backend,frontend,proxy}`).

Prérequis Jenkins : credential **Secret text** `github-token` (PAT GitHub, scope
`repo`). Voir `CONTRIBUTING.md`.