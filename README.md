# ci-cd-projet

- Frontend : http://localhost:3000
- Backend : http://localhost:5000/books
- Jenkins : http://localhost:8080
- SonarQube : http://localhost:9000
- Nexus : http://localhost:8081
- Nexus Docker Registry : http://localhost:8082
- Prometheus : http://localhost:9090
- Grafana : http://localhost:3002

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

## Démarrage de la stack

La stack complète est démarrée avec Docker Compose :

```bash
docker compose up -d --build
docker compose ps
```

Elle comprend Jenkins et son agent dédié `docker-agent`, SonarQube, Nexus,
PostgreSQL, les environnements applicatifs, le reverse proxy et la supervision
DORA. Les données persistantes sont stockées dans les volumes Docker.

Sur Linux, SonarQube peut nécessiter :

```bash
sudo sysctl -w vm.max_map_count=262144
```

Le mot de passe administrateur Grafana peut être fourni par
`GRAFANA_ADMIN_PASSWORD` dans l'environnement. Pour un lancement local sans
configuration supplémentaire, la valeur par défaut est `admin`; l'accès
anonyme en lecture est activé pour consulter le dashboard DORA.

## CI/CD et exigences du sujet

Le pipeline as code dans `Jenkinsfile` exécute les étapes suivantes :

1. lint, tests unitaires, couverture et rapports JUnit frontend/backend en
  parallèle ;
2. validation des messages Conventional Commits ;
3. tests d'intégration PostgreSQL/backend avec Docker Compose ;
4. analyse SonarQube et contrôle du Quality Gate ;
5. construction et publication des images backend, frontend et proxy dans le
  dépôt Docker Nexus `docker-hosted` sur le port `8082` ;
6. déploiement automatique en staging depuis `main` ;
7. validation manuelle par `admin` ;
8. déploiement blue/green en production avec vérification de santé et rollback ;
9. release semantic-release, changelog, tag GitHub et retagage des images avec
  la version publiée.

Le déploiement staging utilise le projet Compose `ci-cd-projet` afin de
réutiliser les conteneurs de la stack locale et de ne pas recréer Nexus,
SonarQube ou Jenkins. Le pipeline construit les images avec le contexte racine
du dépôt ; les Dockerfiles et Compose doivent conserver cette convention.

## Observabilité DORA

Le collecteur `dora-collector` reçoit les événements réels du pipeline et les
conserve dans le volume `dora_events`. Prometheus scrape ses métriques et
Grafana charge automatiquement le dashboard **DORA metrics**.

- Collecteur : réseau Compose, port interne `9100` ;
- Prometheus : http://localhost:9090 ;
- Grafana : http://localhost:3002 ;
- Dashboard : dossier `CI/CD`, dashboard `DORA metrics`.

Les métriques sont définies ainsi :

- fréquence de déploiement : nombre de déploiements réussis sur les dernières
  24 heures ;
- délai de livraison : durée entre la date du commit et le déploiement réussi ;
- taux d'échec des changements : pipelines échoués / pipelines enregistrés ;
- délai de restauration : durée entre un pipeline échoué et le déploiement
  réussi suivant.

Les événements sont envoyés par Jenkins après les déploiements staging et
production, ainsi qu'à la fin de chaque pipeline. La supervision est
non bloquante : une panne du collecteur ne doit pas faire échouer une livraison.

## Configuration Jenkins à finaliser

La Shared Library `book-catalog-shared` est chargée par le Jenkinsfile avec la
version `v1.0.0`. Les fonctions communes sont dans `vars/` et la configuration
initiale Jenkins la déclare depuis le dépôt GitHub. Le tag `v1.0.0` doit être
créé et poussé avant le premier build utilisant cette bibliothèque.

L'image Jenkins de Compose installe les plugins nécessaires au pipeline, au
Job DSL, au Multibranch et aux Shared Libraries. Le script
`jenkins/job-dsl/book-catalog-multibranch.groovy` crée le job
`book-catalog-multibranch` pour `akashiyo/ci-cd-projet` avec découverte des
branches et des Pull Requests. Son exécution est documentée dans
`jenkins/job-dsl/README.md`.

Le webhook GitHub à configurer est :

```text
http://<jenkins-host>/github-webhook/
```

La configuration doit utiliser le credential Jenkins `github-token` et le
credential Docker `docker-registry-creds`; aucun token ne doit être ajouté au
dépôt.

Les éléments suivants restent dépendants de la configuration de l'instance
Jenkins et doivent être vérifiés avant le rendu :

- remontée du statut Jenkins sur les Pull Requests ;
- Quality Gate SonarQube bloquante, en retirant le mode temporairement non
  bloquant du Jenkinsfile ;
- credential `github-token` pour semantic-release ;
- notifications de chaque build ;
- vérification du temps total du pipeline sous dix minutes.
- exécution d'un build Jenkins réel avec envoi d'événements vers le collecteur
  DORA et vérification des valeurs dans Prometheus/Grafana.

Le projet utilise un seul hôte Docker pour la démonstration : staging,
production blue/green, PostgreSQL, Jenkins, SonarQube et Nexus partagent cet
hôte. Cette limite doit être distinguée d'une architecture multi-serveurs réelle.