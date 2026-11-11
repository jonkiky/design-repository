"""Local preview plus same-origin proxy to the existing, unmodified backend."""
import argparse
import http.client
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="裁研三种设计预览")
parser.add_argument("--port", type=int, default=8878)
parser.add_argument("--backend-port", type=int, default=8765)
args = parser.parse_args()

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def dispatch(self):
        if not self.path.startswith('/api/'):
            if self.command == 'GET': return super().do_GET()
            if self.command == 'HEAD': return super().do_HEAD()
            return self.send_error(405)
        connection = http.client.HTTPConnection('127.0.0.1', args.backend_port, timeout=120)
        try:
            body = self.rfile.read(int(self.headers.get('Content-Length', 0))) or None
            headers = {k:v for k,v in self.headers.items() if k.lower() not in ('host','connection','accept-encoding')}
            headers['Host'] = self.headers.get('Host', f'127.0.0.1:{args.port}')
            # Preserve browser cookies, CSRF and origin. Backend authorization
            # remains authoritative; the proxy does not inject credentials.
            connection.request(self.command, self.path, body=body, headers=headers)
            response = connection.getresponse()
            self.send_response(response.status)
            stream = response.getheader('Content-Type', '').startswith('text/event-stream')
            for k,v in response.getheaders():
                if k.lower() not in ('transfer-encoding','connection','content-length'):
                    self.send_header(k,v)
            self.send_header('Cache-Control','no-store')
            self.end_headers()
            if stream:
                while chunk := response.readline():
                    self.wfile.write(chunk); self.wfile.flush()
            else:
                self.wfile.write(response.read())
        except (ConnectionError, TimeoutError, OSError) as exc:
            try:
                self.send_response(502)
                self.send_header('Content-Type','application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'detail':'本地服务尚未启动。请先运行原项目 start.sh，或返回示例预览。'},ensure_ascii=False).encode())
            except OSError:
                pass
        finally:
            connection.close()

    do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = dispatch

print(f'设计预览：http://127.0.0.1:{args.port} ；原服务端口：{args.backend_port}', flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
