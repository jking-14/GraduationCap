"""Shared two-player game state and optional HTTPS development tunnel."""
import re
import secrets
import shutil
import subprocess
import threading
import time


class TugGame:
    def __init__(self, clock=time.monotonic):
        self.clock=clock
        self.lock=threading.RLock()
        self.players={"red":None,"blue":None}
        self.phase="waiting"
        self.score=0
        self.winner=None
        self.deadline=0
        self.round=0

    def _tick(self):
        now=self.clock()
        if self.phase in {"countdown","playing"}:
            absent=[side for side,p in self.players.items() if not p or now-p["seen"]>15]
            if absent:
                self.phase="finished";self.winner="blue" if "red" in absent and "blue" not in absent else "red" if "blue" in absent and "red" not in absent else "draw"
            elif self.phase=="countdown" and now>=self.deadline:
                self.phase="playing";self.deadline=now+20
                for p in self.players.values():p["credits"]=3;p["refill"]=now
            elif self.phase=="playing" and now>=self.deadline:
                self.phase="finished";self.winner="red" if self.score>0 else "blue" if self.score<0 else "draw"
        for side,p in self.players.items():
            if p and now-p["seen"]>30 and self.phase not in {"playing","countdown"}:self.players[side]=None

    def _player(self, token):
        if not isinstance(token,str):raise ValueError("Choose a player first")
        for side,p in self.players.items():
            if p and secrets.compare_digest(p["token"].encode(),token.encode()):return side,p
        raise ValueError("Your player seat expired; choose a player again")

    def join(self, side, client):
        if not isinstance(side,str) or side not in {"red","blue"} or not isinstance(client,str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,80}",client):raise ValueError("Invalid player selection")
        with self.lock:
            self._tick();now=self.clock()
            for other,p in self.players.items():
                if p and p["client"]==client:
                    if other!=side:raise ValueError("One player per phone. Leave your current seat first")
                    p["seen"]=now;return p["token"]
            if self.players[side]:raise ValueError("That player is already taken on another phone")
            if self.phase in {"countdown","playing"}:raise ValueError("Wait for this round to finish")
            token=secrets.token_urlsafe(24)
            self.players[side]={"token":token,"client":client,"seen":now,"seq":0,"credits":3.,"refill":now,"taps":0}
            return token

    def state(self, token=None):
        with self.lock:
            self._tick();side=None
            if token:
                try:side,p=self._player(token);p["seen"]=self.clock()
                except ValueError:pass
            return {"players":{s:bool(p) for s,p in self.players.items()},"you":side,"phase":self.phase,"score":self.score,"winner":self.winner,"remaining":max(0,self.deadline-self.clock()) if self.phase in {"countdown","playing"} else 0,"round":self.round,"taps":{s:p["taps"] if p else 0 for s,p in self.players.items()}}

    def start(self, token):
        with self.lock:
            self._tick();self._player(token)
            if not all(self.players.values()):raise ValueError("Both players must join before starting")
            if self.phase in {"countdown","playing"}:raise ValueError("A round is already running")
            self.phase="countdown";self.score=0;self.winner=None;self.deadline=self.clock()+3;self.round+=1
            for p in self.players.values():p["taps"]=0;p["credits"]=3.;p["refill"]=self.clock()

    def tap(self, token, seq, count):
        if type(seq) is not int or not 1<=seq<=2147483647 or type(count) is not int or not 1<=count<=10:raise ValueError("Invalid tap batch")
        with self.lock:
            self._tick();side,p=self._player(token);now=self.clock();p["seen"]=now
            if seq<=p["seq"]:return 0
            p["seq"]=seq
            if self.phase!="playing":return 0
            p["credits"]=min(5.,p["credits"]+(now-p["refill"])*12);p["refill"]=now
            accepted=min(count,int(p["credits"]));p["credits"]-=accepted;p["taps"]+=accepted
            self.score=max(-40,min(40,self.score+(accepted if side=="red" else -accepted)))
            if abs(self.score)>=40:self.phase="finished";self.winner="red" if self.score>0 else "blue"
            return accepted

    def leave(self, token):
        with self.lock:
            side,_=self._player(token);self.players[side]=None;self._tick()

    def pause(self):
        with self.lock:
            if self.phase in {"playing","countdown"}:self.phase="waiting";self.score=0;self.winner=None


def start_tunnel(port, on_ready):
    binary=shutil.which("cloudflared")
    if not binary:raise RuntimeError("cloudflared is not installed. Install it from https://developers.cloudflare.com/tunnel/downloads/ then restart with --tunnel.")
    process=subprocess.Popen([binary,"tunnel","--url",f"http://127.0.0.1:{port}","--http-host-header",f"127.0.0.1:{port}","--no-autoupdate"],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
    def read():
        found=False
        for line in process.stdout:
            match=re.search(r"https://[a-z0-9-]+\.trycloudflare\.com",line)
            if match and match.group(0)!="https://api.trycloudflare.com" and not found:found=True;on_ready(match.group(0))
        if not found:print("HTTPS tunnel did not start. Check cloudflared and your internet connection; local control is still available.",flush=True)
    threading.Thread(target=read,daemon=True).start()
    return process
