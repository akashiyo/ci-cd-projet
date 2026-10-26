pipeline {
    agent any

    environment {
        // Configuration Nexus / Docker Registry
        REGISTRY = "nexus:8082" // Port Docker de Nexus
        IMAGE_BACKEND = "nexus:8082/book-catalog-backend:latest"
        IMAGE_FRONTEND = "nexus:8082/book-catalog-frontend:latest"

        // SonarQube
        SONAR_PROJECT_KEY = "book-catalog-project"
        SONAR_SERVER_ID = "SonarQube" // Le nom configuré dans Global Tool Configuration
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
                            sh 'npm test -- --coverage'
                        }
                    }
                }
                stage('Frontend Quality') {
                    steps {
                        dir('frontend') {
                            sh 'npm install'
                            sh 'npm run lint'
                            sh 'npm test -- --coverage --watchAll=false'
                        }
                    }
                }
            }
        }

        stage('Static Analysis') {
            steps {
                // Utilisation du scanner SonarQube configuré dans Jenkins
                withSonarQubeEnv("${SONAR_SERVER_ID}") {
                    sh "sonar-scanner \
                        -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                        -Dsonar.sources=. \
                        -Dsonar.javascript.lcov.reportPaths=backend/coverage/lcov.info,frontend/coverage/lcov.info"
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
                // Ici, on simule le déploiement en demandant au docker-compose
                // de mettre à jour les containers avec les nouvelles images de Nexus
                sh 'docker-compose pull'
                sh 'docker-compose up -d'
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
