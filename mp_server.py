"""Сетевой ретранслятор «Линии фронта» для игры по локальной сети.

Хост-приложение запускает его само (кнопка «Комнаты» → «Создать комнату»).
Можно запустить и отдельно:  python mp_server.py "Моя комната"

Устройство: WebSocket-сервер на стандартной библиотеке Python. Игра хоста подключается к нему с 127.0.0.1
и ведёт всю логику; клиенты подключаются по коду комнаты. Сервер только пересылает сообщения:
клиент → хост ({t:'msg', from, data}), хост → клиенты ({t:'send', to, data}). Раз в секунду в локальную сеть
уходит UDP-маяк с названием комнаты (без кода), по нему клиенты находят комнаты.
"""
import base64
import hashlib
import json
import random
import socket
import socketserver
import string
import struct
import sys
import threading
import time

GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
DISCOVERY_PORT = 47801
CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


class WSConn:
    """Минимальное WebSocket-соединение: текстовые кадры, ping/pong, закрытие."""

    def __init__(self, sock):
        self.sock = sock
        self.lock = threading.Lock()
        self.buf = b''

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(max(65536, n - len(self.buf)))
            if not chunk:
                raise ConnectionError('closed')
            self.buf += chunk
        data, self.buf = self.buf[:n], self.buf[n:]
        return data

    def handshake(self):
        while b'\r\n\r\n' not in self.buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError('closed')
            self.buf += chunk
            if len(self.buf) > 65536:
                raise ConnectionError('bad request')
        head, self.buf = self.buf.split(b'\r\n\r\n', 1)
        headers = {}
        for line in head.decode('latin-1').split('\r\n')[1:]:
            if ':' in line:
                k, v = line.split(':', 1)
                headers[k.strip().lower()] = v.strip()
        key = headers.get('sec-websocket-key')
        if not key:
            body = b'{"app":"liniya-fronta"}'
            self.sock.sendall(b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: '
                              + str(len(body)).encode() + b'\r\n\r\n' + body)
            raise ConnectionError('not websocket')
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        self.sock.sendall(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                           f'Sec-WebSocket-Accept: {accept}\r\n\r\n').encode())

    def send(self, text):
        data = text.encode('utf-8')
        n = len(data)
        hdr = bytearray([0x81])
        if n < 126:
            hdr.append(n)
        elif n < 65536:
            hdr.append(126)
            hdr += struct.pack('>H', n)
        else:
            hdr.append(127)
            hdr += struct.pack('>Q', n)
        with self.lock:
            self.sock.sendall(bytes(hdr) + data)

    def recv(self):
        parts = []
        while True:
            b0, b1 = self._read(2)
            op, masked, n = b0 & 0x0F, b1 & 0x80, b1 & 0x7F
            if n == 126:
                n = struct.unpack('>H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._read(8))[0]
            mask = self._read(4) if masked else None
            payload = self._read(n)
            if mask and n:
                m = (mask * (n // 4 + 1))[:n]
                payload = (int.from_bytes(payload, 'big') ^ int.from_bytes(m, 'big')).to_bytes(n, 'big')
            if op == 8:
                return None
            if op == 9:
                with self.lock:
                    self.sock.sendall(bytes([0x8A, len(payload)]) + payload[:125])
                continue
            if op == 10:
                continue
            parts.append(payload)
            if b0 & 0x80:
                return b''.join(parts).decode('utf-8')

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


class Room:
    def __init__(self, name, port):
        self.name = name
        self.port = port
        self.code = ''.join(random.choice(CODE_CHARS) for _ in range(6))
        self.host = None
        self.clients = {}
        self.names = {}
        self.next_id = 1
        self.started = False
        self.lock = threading.Lock()
        self.alive = True

    def to_host(self, obj):
        if self.host:
            try:
                self.host.send(json.dumps(obj, ensure_ascii=False))
            except OSError:
                pass

    def handle(self, conn, addr):
        hello = json.loads(conn.recv() or '{}')
        if hello.get('code', '').upper() != self.code:
            conn.send(json.dumps({'t': 'error', 'msg': 'Неверный код комнаты'}, ensure_ascii=False))
            return
        if hello.get('role') == 'host':
            if addr[0] not in ('127.0.0.1', '::1') or self.host:
                conn.send(json.dumps({'t': 'error', 'msg': 'Хост уже подключён'}, ensure_ascii=False))
                return
            self.host = conn
            conn.send(json.dumps({'t': 'welcome', 'id': 0}))
            try:
                while True:
                    raw = conn.recv()
                    if raw is None:
                        break
                    msg = json.loads(raw)
                    t = msg.get('t')
                    if t == 'send':
                        data = json.dumps(msg.get('data'), ensure_ascii=False)
                        with self.lock:
                            targets = list(self.clients.values()) if msg.get('to') == 'all' else [self.clients.get(int(msg.get('to', -1)))]
                        for c in targets:
                            if c:
                                try:
                                    c.send(data)
                                except OSError:
                                    pass
                    elif t == 'kick':
                        with self.lock:
                            c = self.clients.pop(int(msg.get('id', -1)), None)
                        if c:
                            try:
                                c.send('{"t":"kicked"}')
                            except OSError:
                                pass
                            c.close()
                    elif t == 'state':
                        self.started = bool(msg.get('started'))
            finally:
                self.host = None
                with self.lock:
                    clients = list(self.clients.values())
                    self.clients.clear()
                for c in clients:
                    try:
                        c.send('{"t":"hostgone"}')
                    except OSError:
                        pass
                    c.close()
            return
        # клиент
        if not self.host:
            conn.send(json.dumps({'t': 'error', 'msg': 'Хост ещё не готов'}, ensure_ascii=False))
            return
        with self.lock:
            cid = self.next_id
            self.next_id += 1
            self.clients[cid] = conn
            name = str(hello.get('name', 'Игрок'))[:20]
            self.names[cid] = name
        conn.send(json.dumps({'t': 'welcome', 'id': cid}))
        self.to_host({'t': 'join', 'id': cid, 'name': name, 'ip': addr[0]})
        try:
            while True:
                raw = conn.recv()
                if raw is None:
                    break
                self.to_host({'t': 'msg', 'from': cid, 'data': json.loads(raw)})
        finally:
            with self.lock:
                was = self.clients.pop(cid, None)
            if was is not None:
                self.to_host({'t': 'leave', 'id': cid})


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


def make_handler(room):
    class Handler(socketserver.BaseRequestHandler):
        def handle(self):
            self.request.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            conn = WSConn(self.request)
            try:
                conn.handshake()
                room.handle(conn, self.client_address)
            except (ConnectionError, OSError, ValueError):
                pass
            finally:
                conn.close()
    return Handler


def local_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip.startswith('127.'):
                ips.add(ip)
    except OSError:
        pass
    return sorted(ips)


class Hosting:
    """Запущенная комната: TCP-сервер + UDP-маяк."""

    def __init__(self, name, port=47800):
        self.room = None
        self.server = None
        for p in range(port, port + 10):
            try:
                self.room = Room(name, p)
                self.server = Server(('0.0.0.0', p), make_handler(self.room))
                break
            except OSError:
                continue
        if not self.server:
            raise OSError('Нет свободного порта для комнаты')
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        threading.Thread(target=self._beacon, daemon=True).start()

    def _beacon(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        while self.room.alive:
            msg = json.dumps({'app': 'liniya', 'name': self.room.name, 'port': self.room.port,
                              'players': len(self.room.clients) + 1, 'started': self.room.started}, ensure_ascii=False).encode()
            for target in ('255.255.255.255', '127.0.0.1'):
                try:
                    s.sendto(msg, (target, DISCOVERY_PORT))
                except OSError:
                    pass
            time.sleep(1)
        s.close()

    def info(self):
        return {'code': self.room.code, 'port': self.room.port, 'ips': local_ips()}

    def stop(self):
        self.room.alive = False
        self.server.shutdown()
        self.server.server_close()


def scan(timeout=1.6):
    """Слушает UDP-маяки комнат в локальной сети."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.settimeout(.3)
    rooms = {}
    try:
        s.bind(('', DISCOVERY_PORT))
        end = time.time() + timeout
        while time.time() < end:
            try:
                data, addr = s.recvfrom(4096)
            except socket.timeout:
                continue
            try:
                info = json.loads(data.decode('utf-8'))
            except ValueError:
                continue
            if info.get('app') != 'liniya':
                continue
            ip = addr[0]
            if ip.startswith('127.'):
                ip = (local_ips() or ['127.0.0.1'])[0]
            rooms[(ip, info.get('port'))] = {'name': info.get('name', '?'), 'ip': ip, 'port': info.get('port'),
                                            'players': info.get('players', 1), 'started': info.get('started', False)}
    finally:
        s.close()
    # одна запись на комнату: предпочитаем адрес домашней сети
    def rank(ip):
        return 0 if ip.startswith('192.168.') else 1 if ip.startswith('10.') or ip.startswith('172.') else 2
    best = {}
    for r in rooms.values():
        k = (r['name'], r['port'])
        if k not in best or rank(r['ip']) < rank(best[k]['ip']):
            best[k] = r
    return list(best.values())


if __name__ == '__main__':
    h = Hosting(sys.argv[1] if len(sys.argv) > 1 else 'Комната')
    print(f'Комната запущена: код {h.room.code}, порт {h.room.port}, адреса {", ".join(local_ips())}')
    print('Хост подключается к ws://127.0.0.1:%d с этим кодом. Ctrl+C — остановить.' % h.room.port)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        h.stop()
