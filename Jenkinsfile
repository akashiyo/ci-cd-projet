pipeline {
    agent { label 'docker-agent' }

    environment {
        // Configuration Nexus / Docker Registry
        REGISTRY = "nexus:8082" // Port Docker de Nexus

        // SonarQube
        SONAR_PROJECT_KEY = "book-catalog-project"
        SONAR_SERVER_ID = "SonarQube" // Le nom configuré dans Global Tool Configuration
    }

    tools {
        nodejs 'node'
    }

    stages {
        stage('Lint & Test') {
            parallel {
                stage('Backend Quality') {
                    steps {
                        dir('backend') {
                            // On utilise un container node pour être sûr de l'environnement
                            sh 'npm install'
                            sh 'npm run lint'
                            sh 'npm run test:junit'
                        }
                    }
                }
                stage('Frontend Quality') {
                    steps {
                        dir('frontend') {
                            sh 'npm install'
                            sh 'npm run lint'
                            sh 'npm run test:junit'
                        }
                    }
                }
            }
        }

        stage('Publish Test Reports') {
            steps {
                junit 'backend/reports/junit.xml'
                junit 'frontend/reports/junit.xml'
                archiveArtifacts artifacts: 'backend/coverage/**,frontend/coverage/**', allowEmptyArchive: false
            }
        }

        stage('Integration Tests') {
            steps {
                sh 'bash ./tests/integration.sh'
            }
        }

        stage('Static Analysis') {
            steps {
                script {
                    // On récupère le chemin vers l'outil configuré dans Tools
                    def scannerHome = tool 'sonar-scanner'

                    withSonarQubeEnv("${SONAR_SERVER_ID}") {
                        sh "${scannerHome}/bin/sonar-scanner \
                            -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                            -Dsonar.sources=. \
                            -Dsonar.javascript.lcov.reportPaths=backend/coverage/lcov.info,frontend/coverage/lcov.info"
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                // On attend que SonarQube valide le projet avant de continuer
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build & Push Images') {
            steps {
                script {
                    // On s'authentifie sur Nexus
                    def commit = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
                    def imageTag = "${env.BUILD_NUMBER}-${commit}"
                    env.IMAGE_BACKEND = "${REGISTRY}/book-catalog-backend:${imageTag}"
                    env.IMAGE_FRONTEND = "${REGISTRY}/book-catalog-frontend:${imageTag}"

                    docker.withRegistry("http://${REGISTRY}", 'docker-registry-creds') {
                        // Build et Push Backend
                        def backendImg = docker.build("${IMAGE_BACKEND}", "-f backend/Dockerfile .")
                        backendImg.push()

                        // Build et Push Frontend
                        def frontendImg = docker.build("${IMAGE_FRONTEND}", "-f frontend/Dockerfile .")
                        frontendImg.push()
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    docker.withRegistry("http://${REGISTRY}", 'docker-registry-creds') {
                        // Compose utilise les mêmes images taguées que celles publiées ci-dessus.
                        sh 'docker-compose pull'
                        sh 'docker-compose up -d --no-build'
                    }
                }
            }
        }
    }

    post {
        always {
            cleanWs() // Nettoyage de l'espace de travail après le run
        }
        success {
            echo 'Pipeline completed successfully! 🚀'
        }
        failure {
            echo 'Pipeline failed. Check the logs! ❌'
        }
    }
}
