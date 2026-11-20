#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 2026-11-20 - portfolio-site - 정확한 화면 너비로 웹페이지 스크린샷을 찍는 도구
# 파일 위치: ai-agent/scripts/screenshot.py
#
# 사용: py -3 ai-agent/scripts/screenshot.py URL 출력경로 너비 높이 [png|jpeg] [품질]
# 예:   py -3 ai-agent/scripts/screenshot.py http://localhost:8000/demos/haru-bakery/ src/assets/haru-bakery-375.jpg 375 800 jpeg 80
#
# 왜 CDP인가: 헤드리스 Edge는 --window-size로 약 496px보다 좁게 못 만든다.
# DevTools 프로토콜의 기기 에뮬레이션(Emulation.setDeviceMetricsOverride)은
# 창 크기와 상관없이 CSS 너비를 정확히 맞춘다. 표준 라이브러리만 쓴다.

import base64
import json
import re
import secrets
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9333


class WebSocket:
    """CDP 호출에 필요한 만큼만 구현한 WebSocket 클라이언트 (smart-voca browser_check_lib와 같은 방식)."""

    def __init__(self, url: str) -> None:
        m = re.match(r"ws://([^:/]+):(\d+)(/.*)", url)
        self.sock = socket.create_connection((m[1], int(m[2])))
        key = base64.b64encode(secrets.token_bytes(16)).decode()
        self.sock.sendall(
            (f"GET {m[3]} HTTP/1.1\r\nHost: {m[1]}:{m[2]}\r\nUpgrade: websocket\r\n"
             f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode()
        )
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.sock.recv(1)

    def send(self, text: str) -> None:
        data = text.encode()
        mask = secrets.token_bytes(4)
        n = len(data)
        if n < 126:
            head = bytes([0x80 | n])
        elif n < 65536:
            head = bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            head = bytes([0x80 | 127]) + struct.pack(">Q", n)
        self.sock.sendall(b"\x81" + head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _exact(self, n: int) -> bytes:
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise EOFError("브라우저 연결이 끊겼습니다.")
            buf += chunk
        return buf

    def receive(self) -> str:
        payload = b""
        while True:
            first, second = self._exact(2)
            n = second & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._exact(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._exact(8))[0]
            payload += self._exact(n)
            if first & 0x80:
                return payload.decode()


class Cdp:
    def __init__(self, ws_url: str) -> None:
        self.ws = WebSocket(ws_url)
        self.next_id = 0

    def call(self, method: str, **params):
        self.next_id += 1
        self.ws.send(json.dumps({"id": self.next_id, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.receive())
            if msg.get("id") == self.next_id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    def js(self, expr: str):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        return r.get("result", {}).get("value")


def image_size(path: Path) -> tuple[int, int]:
    """저장된 파일의 실제 픽셀 크기를 헤더에서 읽어 확인한다 (PNG IHDR, JPEG SOF)."""
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    i = 2
    while i < len(data):
        marker = data[i + 1]
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        i += 2 + length
    raise ValueError("이미지 크기를 읽지 못했습니다.")


def main() -> int:
    if len(sys.argv) < 5:
        print(__doc__ or "사용법: screenshot.py URL 출력경로 너비 높이 [png|jpeg] [품질]")
        return 2
    url, out, width, height = sys.argv[1], Path(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
    fmt = sys.argv[5] if len(sys.argv) > 5 else "png"
    quality = int(sys.argv[6]) if len(sys.argv) > 6 else 80

    profile = tempfile.mkdtemp(prefix="shot-profile-")
    proc = subprocess.Popen(
        [EDGE, "--headless=new", "--hide-scrollbars", f"--remote-debugging-port={PORT}",
         f"--user-data-dir={profile}", "--no-first-run", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        ws_url = None
        for _ in range(100):  # 브라우저가 뜰 때까지 최대 10초 기다린다
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
                ws_url = next(t["webSocketDebuggerUrl"] for t in tabs if t["type"] == "page")
                break
            except Exception:
                time.sleep(0.1)
        if not ws_url:
            print("브라우저에 연결하지 못했습니다.")
            return 1
        cdp = Cdp(ws_url)
        cdp.call("Page.enable")
        # mobile=True여야 375px 레이아웃 뷰포트가 그대로 유지된다
        cdp.call("Emulation.setDeviceMetricsOverride", width=width, height=height,
                 deviceScaleFactor=1, mobile=width < 768)
        cdp.call("Page.navigate", url=url)
        for _ in range(150):  # load 이벤트까지 최대 15초
            if cdp.js("document.readyState") == "complete":
                break
            time.sleep(0.1)
        # 글꼴과 (lazy 포함) 이미지가 다 받아질 때까지 기다린다
        cdp.js("document.fonts.ready.then(()=>true)")
        cdp.js("""Promise.all([...document.images].map(i => { i.loading='eager';
            return i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }); })).then(()=>true)""")
        time.sleep(0.5)
        print("innerWidth:", cdp.js("innerWidth"), "scrollWidth:", cdp.js("document.documentElement.scrollWidth"))
        params = {"format": fmt}
        if fmt == "jpeg":
            params["quality"] = quality
        data = cdp.call("Page.captureScreenshot", **params)["data"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(base64.b64decode(data))
    finally:
        proc.terminate()
    w, h = image_size(out)
    print(f"{out} {w}x{h} {out.stat().st_size // 1024}KB")
    return 0 if (w, h) == (width, height) else 1


if __name__ == "__main__":
    sys.exit(main())
