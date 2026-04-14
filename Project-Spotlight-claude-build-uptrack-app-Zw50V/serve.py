#!/usr/bin/env python3
"""DEVELOPER / TROUBLESHOOTING ONLY — not for enterprise deployment.

The supported way to run Uptrack is to open index.html directly in a browser
(a file:// origin). See README.md "Enterprise deployment" for the full story.

This tiny static server exists solely as a recovery fallback: if a particular
browser misbehaves with IndexedDB on file:// origins, you can point it at a
localhost origin instead to confirm whether the issue is file:// specific.

DO NOT run this on a managed or shared workstation. Python's http.server is
not production-safe (the stdlib documentation says so explicitly), and
long-running Python listeners are commonly flagged by enterprise EDR tools.

Usage:
    python3 serve.py          # serves on http://localhost:8765
    python3 serve.py 9000     # custom port
"""
import http.server
import os
import socket
import socketserver
import sys
import webbrowser

DEFAULT_PORT = 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching so in-progress development always sees the latest file.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):  # quieter output
        sys.stderr.write("[uptrack] %s - %s\n" % (self.log_date_time_string(), format % args))


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port:", sys.argv[1])
            sys.exit(1)

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    try:
        with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
            url = "http://localhost:%d/" % port
            print("Uptrack serving at %s" % url)
            print("Press Ctrl+C to stop.")
            try:
                webbrowser.open(url)
            except Exception:
                pass
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nShutting down.")
    except OSError as e:
        print("Could not bind to port %d: %s" % (port, e))
        sys.exit(1)


if __name__ == "__main__":
    main()
