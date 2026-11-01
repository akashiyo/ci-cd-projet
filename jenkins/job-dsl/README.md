# Jenkins provisioning

## Plugins

The Multibranch definition requires these Jenkins plugins:

- Job DSL
- GitHub Branch Source
- Pipeline: Multibranch with `workflow-aggregator`
- Pipeline: Shared Groovy Libraries
- Credentials Binding
- Git

The existing pipeline also requires Docker Pipeline, JUnit, NodeJS and SonarQube Scanner.

## Shared Library

Configure a Global Pipeline Library in **Manage Jenkins > System**:

- Name: `book-catalog-shared`
- Default version: `v1.0.0`
- Retrieval method: Modern SCM, Git
- Repository: `https://github.com/akashiyo/ci-cd-projet.git`
- Library path: repository root

Create and push the `v1.0.0` tag after the library files are reviewed. The
library is loaded by the Jenkinsfile with `@Library('book-catalog-shared@v1.0.0')`.

## Multibranch job

Run `book-catalog-multibranch.groovy` with the Job DSL seed job or paste it in
**Manage Jenkins > Script Console** after installing Job DSL. It creates a
Multibranch job for `akashiyo/ci-cd-projet`, discovers branches and pull requests,
and uses `Jenkinsfile` from each branch.

Configure the GitHub webhook:

```text
http://<jenkins-host>/github-webhook/
```

The `github-token` credential must have repository status and webhook access.
The GitHub Branch Source plugin publishes commit and pull request status for
branches discovered by the Multibranch job.
