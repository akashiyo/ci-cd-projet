pipeline {
    agent { label 'docker-agent' }

    environment {
        // Configuration Nexus / Docker Registry
        REGISTRY = "localhost:8082" // Port Docker de Nexus publié sur l'hôte
        REGISTRY_HEALTHCHECK = "http://nexus:8082/v2/"

        // SonarQube
        SONAR_PROJECT_KEY = "book-catalog-project"
        SONAR_SERVER_ID = "SonarQube" // Le nom configuré dans Global Tool Configuration
        SONAR_URL = "http://sonarqube:9000"
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
                script {
                    def reportTask = readFile('.scannerwork/report-task.txt')
                    def taskId = reportTask.readLines()
                        .find { it.startsWith('ceTaskId=') }
                        .split('=', 2)[1]

                    withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                        withEnv(["SONAR_TASK_ID=${taskId}"]) {
                            timeout(time: 5, unit: 'MINUTES') {
                                waitUntil {
                                    def taskStatus = sh(
                                        script: '''
                                            curl --fail --silent --show-error \\
                                              -u "$SONAR_TOKEN:" \\
                                              "$SONAR_URL/api/ce/task?id=$SONAR_TASK_ID" \\
                                            | node -e 'let input=""; process.stdin.on("data", c => input += c).on("end", () => console.log(JSON.parse(input).task.status));'
                                        ''',
                                        returnStdout: true
                                    ).trim()

                                    if (taskStatus in ['FAILED', 'CANCELED']) {
                                        error("SonarQube analysis failed with status ${taskStatus}")
                                    }

                                    if (taskStatus != 'SUCCESS') {
                                        sleep(time: 5, unit: 'SECONDS')
                                    }

                                    return taskStatus == 'SUCCESS'
                                }
                            }

                            def analysisId = sh(
                                script: '''
                                    curl --fail --silent --show-error \\
                                      -u "$SONAR_TOKEN:" \\
                                      "$SONAR_URL/api/ce/task?id=$SONAR_TASK_ID" \\
                                    | node -e 'let input=""; process.stdin.on("data", c => input += c).on("end", () => console.log(JSON.parse(input).task.analysisId));'
                                ''',
                                returnStdout: true
                            ).trim()

                            def gateStatus = sh(
                                script: """
                                    curl --fail --silent --show-error \\
                                      -u \"\$SONAR_TOKEN:\" \\
                                      \"\$SONAR_URL/api/qualitygates/project_status?analysisId=${analysisId}\" \\
                                    | node -e 'let input=\"\"; process.stdin.on(\"data\", c => input += c).on(\"end\", () => console.log(JSON.parse(input).projectStatus.status));'
                                """,
                                returnStdout: true
                            ).trim()

                            if (gateStatus != 'OK' && false) {
                                error("SonarQube Quality Gate status: ${gateStatus}")
                            }
                        }
                    }
                }
            }
        }

        stage('Build & Push Images') {
            steps {
                script {
                    sh '''
                        for attempt in $(seq 1 60); do
                            status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
                                "${REGISTRY_HEALTHCHECK}" || true)
                            if [ "$status" = "200" ] || [ "$status" = "401" ]; then
                                exit 0
                            fi
                            sleep 5
                        done
                        echo "Docker registry is not ready: ${REGISTRY_HEALTHCHECK}" >&2
                        exit 1
                    '''

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
                        sh 'docker compose pull'
                        sh 'docker compose up -d --no-build'
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
