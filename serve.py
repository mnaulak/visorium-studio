#!/usr/bin/env python3
"""Enkel dev-server som serverar site/ UTAN webbläsarcache.
Skickar no-cache-rubriker så att varje omladdning alltid hämtar färska filer."""
import http.server
import socketserver

PORT = 4173


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serverar på http://localhost:{PORT} (no-cache)")
        httpd.serve_forever()
