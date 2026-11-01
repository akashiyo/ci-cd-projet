#!/usr/bin/env python3
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

EVENTS_FILE = Path(os.environ.get("DORA_EVENTS_FILE", "/data/events.jsonl"))
LOCK = threading.Lock()


def load_events():
    if not EVENTS_FILE.exists():
        return []
    events = []
    with EVENTS_FILE.open(encoding="utf-8") as stream:
        for line in stream:
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return events


def metric(name, help_text, value, metric_type="gauge", labels=None):
    label_text = ""
    if labels:
        label_text = "{" + ",".join(f'{key}="{value}"' for key, value in labels.items()) + "}"
    return f"# HELP {name} {help_text}\n# TYPE {name} {metric_type}\n{name}{label_text} {value}\n"


def render_metrics():
    now = time.time()
    with LOCK:
        events = load_events()

    successful_deployments = [
        event for event in events
        if event.get("type") == "deployment"
        and event.get("environment") == "production"
        and event.get("status") == "success"
    ]
    pipeline_runs = [event for event in events if event.get("type") == "pipeline"]
    failed_runs = [event for event in pipeline_runs if event.get("status") == "failure"]
    recent_deployments = [event for event in successful_deployments if now - event.get("timestamp", 0) <= 86400]
    lead_times = [
        event["timestamp"] - event["commit_timestamp"]
        for event in successful_deployments
        if event.get("timestamp") and event.get("commit_timestamp")
    ]

    recovery_times = []
    for event in successful_deployments:
        previous_failures = [
            failure for failure in failed_runs
            if failure.get("timestamp", 0) < event.get("timestamp", 0)
        ]
        if previous_failures:
            recovery_times.append(event["timestamp"] - max(failure["timestamp"] for failure in previous_failures))

    last_lead_time = lead_times[-1] if lead_times else 0
    last_recovery_time = recovery_times[-1] if recovery_times else 0
    failure_rate = len(failed_runs) / len(pipeline_runs) if pipeline_runs else 0

    output = [
        metric("dora_deployments_total", "Successful deployments recorded by the pipeline", len(successful_deployments), "counter"),
        metric("dora_deployments_last_24h", "Successful deployments in the last 24 hours", len(recent_deployments)),
        metric("dora_pipeline_runs_total", "Pipeline runs recorded by Jenkins", len(pipeline_runs), "counter"),
        metric("dora_pipeline_failures_total", "Failed pipeline runs recorded by Jenkins", len(failed_runs), "counter"),
        metric("dora_change_failure_rate", "Failed pipeline runs divided by all recorded pipeline runs", failure_rate),
        metric("dora_last_lead_time_seconds", "Commit to successful deployment time for the latest deployment", max(0, last_lead_time)),
        metric("dora_last_recovery_time_seconds", "Time from the latest failed pipeline to the following deployment", max(0, last_recovery_time)),
    ]
    return "".join(output)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok\n")
            return
        if self.path == "/metrics":
            body = render_metrics().encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def do_POST(self):
        if self.path != "/events":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            event = json.loads(self.rfile.read(length))
            event.setdefault("timestamp", time.time())
            event["timestamp"] = float(event["timestamp"])
            with LOCK:
                EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
                with EVENTS_FILE.open("a", encoding="utf-8") as stream:
                    stream.write(json.dumps(event, sort_keys=True) + "\n")
            self.send_response(202)
            self.end_headers()
        except (ValueError, json.JSONDecodeError, OSError):
            self.send_error(400)

    def log_message(self, format_string, *args):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 9100), Handler).serve_forever()
