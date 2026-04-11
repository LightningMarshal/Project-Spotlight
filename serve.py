#!/usr/bin/env python3
"""Tiny zero-dependency static file server for Uptrack.

Usage:
    python3 serve.py          # serves on http://localhost:8765
    python3 serve.py 9000     # custom port

The server only serves files from the directory in which it is launched.
Uptrack keeps all data in the browser's IndexedDB — the server is just
responsible for handing out the HTML/CSS/JS files.
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
