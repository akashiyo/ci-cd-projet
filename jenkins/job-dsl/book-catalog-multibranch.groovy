multibranchPipelineJob('book-catalog-multibranch') {
    description('Book Catalog CI/CD Multibranch Pipeline')
    branchSources {
        github {
            id('book-catalog-github')
            repoOwner('akashiyo')
            repository('ci-cd-projet')
            credentialsId('github-token')
            configuredByUrl(false)
            traits {
                gitHubBranchDiscovery {
                    strategyId(3)
                }
                gitHubPullRequestDiscovery {
                    strategyId(2)
                }
                gitHubForkDiscovery {
                    strategyId(1)
                    trust(className: 'org.jenkinsci.plugins.github__branch__source.GitHubForkTrustContributors')
                }
            }
        }
    }
    factory {
        workflowBranchProjectFactory {
            scriptPath('Jenkinsfile')
        }
    }
    orphanedItemStrategy {
        discardOldItems {
            numToKeep(20)
        }
    }
    triggers {
        periodic(5)
    }
}
