#!/usr/bin/env python3
"""
Space Analyzer Launcher Backend
Handles starting/stopping implementation servers and serving the launcher interface
"""

import http.server
import socketserver
import json
import subprocess
import threading
import time
import os
import sys
from urllib.parse import urlparse, parse_qs
from pathlib import Path

# Configuration
BACKEND_PORT = 3002
IMPLEMENTATION_PORTS = {
    'clean': 8082,
    'enhanced': 8083,
    'minimal': 8084,
    'original': 8085
}

# Store running server processes
running_servers = {}

class LauncherHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=".", **kwargs)

    def end_headers(self):
        # Enable CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/running-servers':
            self.handle_list_servers()
        elif parsed_path.path == '/':
            # Serve launcher.html as default
            self.serve_file('launcher.html')
        elif parsed_path.path == '/launcher':
            self.serve_file('launcher.html')
        else:
            # Try to serve static files
            self.serve_file(parsed_path.path.lstrip('/'))

    def do_POST(self):
        parsed_path = urlparse(self.path)
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        if parsed_path.path == '/start-server':
            self.handle_start_server(data)
        elif parsed_path.path == '/stop-server':
            self.handle_stop_server(data)
        else:
            self.send_error(404, "Endpoint not found")

    def serve_file(self, filename):
        """Serve a static file"""
        try:
            file_path = Path(filename)
            if file_path.exists():
                with open(file_path, 'rb') as f:
                    content = f.read()

                # Determine content type
                content_type = 'text/html'
                if filename.endswith('.css'):
                    content_type = 'text/css'
                elif filename.endswith('.js'):
                    content_type = 'application/javascript'
                elif filename.endswith('.json'):
                    content_type = 'application/json'
                elif filename.endswith('.png'):
                    content_type = 'image/png'
                elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
                    content_type = 'image/jpeg'
                elif filename.endswith('.svg'):
                    content_type = 'image/svg+xml'

                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "File not found")
        except Exception as e:
            print(f"Error serving file {filename}: {e}")
            self.send_error(500, "Internal server error")

    def handle_start_server(self, data):
        """Start an implementation server"""
        implementation = data.get('implementation')
        port = data.get('port')

        if not implementation or not port:
            self.send_json_response({
                'success': False,
                'error': 'Missing implementation or port'
            })
            return

        if implementation in running_servers:
            self.send_json_response({
                'success': False,
                'error': f'Server for {implementation} is already running'
            })
            return

        print(f"Starting server for {implementation} on port {port}")

        try:
            # Determine the implementation path
            impl_path = Path(f"implementations/{implementation}")

            if not impl_path.exists():
                self.send_json_response({
                    'success': False,
                    'error': f'Implementation directory not found: {impl_path}'
                })
                return

            # Start the server process
            if implementation == 'rust':
                # For Rust implementation, use cargo run
                process = subprocess.Popen(
                    ['cargo', 'run'],
                    cwd=impl_path,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    env={**os.environ, 'PORT': str(port)}
                )
            else:
                # For Node.js implementations, use npm run dev
                process = subprocess.Popen(
                    ['npm', 'run', 'dev'],
                    cwd=impl_path,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    shell=True,
                    env={**os.environ, 'PORT': str(port)}
                )

            # Store the process
            running_servers[implementation] = process

            # Start a thread to monitor the process output
            def monitor_output():
                try:
                    for line in iter(process.stdout.readline, ''):
                        if line:
                            print(f"{implementation} server: {line.strip()}")
                        if process.poll() is not None:
                            break
                except Exception as e:
                    print(f"Error monitoring {implementation} output: {e}")
                finally:
                    if implementation in running_servers:
                        del running_servers[implementation]
                    print(f"{implementation} server stopped")

            monitor_thread = threading.Thread(target=monitor_output, daemon=True)
            monitor_thread.start()

            # Wait a moment to see if the process starts successfully
            time.sleep(2)

            if process.poll() is None:  # Process is still running
                self.send_json_response({
                    'success': True,
                    'message': f'Server for {implementation} started successfully on port {port}'
                })
            else:
                # Process failed to start
                if implementation in running_servers:
                    del running_servers[implementation]
                self.send_json_response({
                    'success': False,
                    'error': f'Failed to start server for {implementation}'
                })

        except Exception as e:
            print(f"Error starting server for {implementation}: {e}")
            self.send_json_response({
                'success': False,
                'error': f'Error starting server: {str(e)}'
            })

    def handle_stop_server(self, data):
        """Stop an implementation server"""
        implementation = data.get('implementation')

        if not implementation:
            self.send_json_response({
                'success': False,
                'error': 'Missing implementation'
            })
            return

        if implementation not in running_servers:
            self.send_json_response({
                'success': False,
                'error': f'No running server found for {implementation}'
            })
            return

        try:
            process = running_servers[implementation]
            process.terminate()

            # Give it a moment to terminate gracefully
            time.sleep(1)

            if process.poll() is None:
                # Force kill if it didn't terminate
                process.kill()

            del running_servers[implementation]

            self.send_json_response({
                'success': True,
                'message': f'Server for {implementation} stopped'
            })

        except Exception as e:
            print(f"Error stopping server for {implementation}: {e}")
            self.send_json_response({
                'success': False,
                'error': f'Error stopping server: {str(e)}'
            })

    def handle_list_servers(self):
        """List all running servers"""
        servers = list(running_servers.keys())
        self.send_json_response({'servers': servers})

    def send_json_response(self, data):
        """Send a JSON response"""
        response = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)

def main():
    """Main function to start the launcher backend"""
    print("Space Analyzer Launcher Backend")
    print("=" * 50)

    # Check if we're in the right directory
    if not Path("launcher.html").exists():
        print("Error: launcher.html not found in current directory")
        print("Please run this script from the Space Analyzer root directory")
        sys.exit(1)

    # Start the server
    try:
        with socketserver.TCPServer(("", BACKEND_PORT), LauncherHandler) as httpd:
            print(f"Launcher backend server running on http://localhost:{BACKEND_PORT}")
            print(f"Open http://localhost:{BACKEND_PORT}/launcher.html to use the launcher")
            print(f"Available implementations: {', '.join(IMPLEMENTATION_PORTS.keys())}")
            print("\nPress Ctrl+C to stop all servers and exit")
            print("=" * 50)

            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nShutting down...")

                # Stop all running servers
                for implementation, process in running_servers.items():
                    print(f"Stopping {implementation} server...")
                    try:
                        process.terminate()
                        time.sleep(0.5)
                        if process.poll() is None:
                            process.kill()
                    except:
                        pass

                print("All servers stopped")
                sys.exit(0)

    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"Error: Port {BACKEND_PORT} is already in use")
            print("Please stop any other service using this port and try again")
        else:
            print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
