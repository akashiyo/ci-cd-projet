import groovy.json.JsonOutput

def call(Map event = [:]) {
    def payload = event + [timestamp: event.timestamp ?: (System.currentTimeMillis() / 1000L)]
    def json = JsonOutput.toJson(payload).replace("'", "'\\"'\\"'")
    def endpoint = env.DORA_URL ?: "http://dora-collector:9100/events"

    sh label: "Record DORA ${event.type ?: 'event'}", script: """
        curl --silent --show-error --fail --request POST \\
          --header 'Content-Type: application/json' \\
          --data '${json}' \\
          '${endpoint}' || true
    """
}
