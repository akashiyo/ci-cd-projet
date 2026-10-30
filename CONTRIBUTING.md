# Contribution et releases

Prérequis : Node.js >= 18 (y compris le tool Jenkins `node`) pour l'outillage
commitlint / semantic-release.

## Conventional Commits

Tous les commits doivent respecter le format :

```text
<type>(<scope>): <description>
```

Le scope est optionnel. Types utilisés :

| Type | Effet sur la version |
| --- | --- |
| `feat` | nouvelle fonctionnalité → version mineure |
| `fix` | correction → version patch |
| `perf` | amélioration de performance → version patch |
| `refactor`, `style`, `docs`, `test`, `build`, `ci`, `chore` | pas de release |
| `BREAKING CHANGE` (footer) ou `!` après le type | version majeure |

Exemples valides :

```text
feat: add release automation
fix(proxy): retry health check after switch
feat(api)!: remove legacy route

BREAKING CHANGE: la route /legacy est supprimée
```

Le pipeline vérifie les commits depuis le dernier tag (ou le dernier commit au
premier build) avec commitlint. En local :

```bash
npm ci
npx commitlint --from HEAD~1 --to HEAD --verbose
```

Un commit non conventionnel ne déclenche aucune release et est rejeté par le
stage `Commit Messages` de Jenkins.

## Releases automatiques

Le stage `Release` s'exécute uniquement sur `main`, après le déploiement en
production. semantic-release :

- calcule la version à partir des commits (`1.0.0` pour la première release) ;
- génère et met à jour `CHANGELOG.md` ;
- crée le tag `vX.Y.Z` et le commit `chore(release): X.Y.Z [skip ci]` ;
- publie la release GitHub avec les notes de version ;
- écrit `release-version.txt`, utilisé par Jenkins pour taguer les images Nexus
  `book-catalog-{backend,frontend,proxy}:X.Y.Z` en plus du tag
  `${BUILD_NUMBER}-${sha12}`.

## Prérequis Jenkins

Créer un credential **Secret text** avec l'ID `github-token`. Sa valeur est un
Personal Access Token GitHub disposant du scope `repo`. Il est utilisé pour
pousser le tag et le commit de release, puis pour créer la release GitHub.

Si le credential est absent ou invalide, le stage `Release` échoue après le
déploiement production.
