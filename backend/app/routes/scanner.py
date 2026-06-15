from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

router = APIRouter(tags=["scanner"])

_CAPTURE_RE = re.compile(r"\D+")
_MIN_LEN = 6
_MAX_LEN = 20
_DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "scanner-captures.json"
_FILE_LOCK = Lock()


class ScannerCaptureIn(BaseModel):
    rawInput: str | None = None
    numeroAtendimento: str | None = None
    source: str | None = "scanner-hid"


class ScannerCaptureOut(BaseModel):
    id: str
    numeroAtendimento: str
    rawInput: str
    source: str
    capturedAt: str


HTML_PAGE = """<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scanner SIMPLE SURGERY</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #0f1211; color: #ecf2ec; }
    .wrap { max-width: 900px; margin: 24px auto; padding: 0 16px; }
    .card { border: 1px solid #2c342f; border-radius: 12px; background: #151a18; padding: 16px; margin-bottom: 16px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { display: block; font-size: 12px; color: #9fb09f; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .06em; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #3a463e; border-radius: 10px; background: #101513; color: #e8efe8; padding: 10px; }
    textarea { min-height: 120px; }
    button { border: 1px solid #7f9f58; background: #9fcf56; color: #1f2a10; font-weight: 700; border-radius: 10px; padding: 10px 14px; cursor: pointer; }
    button.secondary { background: transparent; color: #c7d3c7; border-color: #4a594d; }
    .actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .status { margin-top: 8px; font-size: 14px; color: #d6e2d6; }
    .item { border: 1px solid #2e3831; border-radius: 10px; padding: 8px; margin-top: 8px; background: #121715; }
    .mono { font-family: Consolas, monospace; }
    @media (max-width: 800px) { .row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Scanner de Atendimento - SIMPLE SURGERY</h1>
      <p>Clique em ativar, leia no scanner e pressione Enter.</p>
      <div class="row">
        <div>
          <label>Processo atual</label>
          <input id="processo" placeholder="ex.: proc-2026-001" />
        </div>
        <div>
          <label>Número manual</label>
          <input id="manual" placeholder="somente números" />
        </div>
      </div>
      <div style="margin-top:10px">
        <label>Área de leitura</label>
        <textarea id="scan" placeholder="Ative e leia o código"></textarea>
      </div>
      <div class="actions">
        <button id="btnActivate">Ativar Captura</button>
        <button id="btnSave">Capturar Manual</button>
        <button class="secondary" id="btnClear">Limpar</button>
      </div>
      <div class="status" id="status">Aguardando leitura...</div>
    </div>

    <div class="card">
      <h2>Histórico</h2>
      <div id="list"></div>
    </div>
  </div>

  <script>
    const el = {
      scan: document.getElementById('scan'),
      manual: document.getElementById('manual'),
      status: document.getElementById('status'),
      list: document.getElementById('list'),
      btnActivate: document.getElementById('btnActivate'),
      btnSave: document.getElementById('btnSave'),
      btnClear: document.getElementById('btnClear')
    };

    function setStatus(msg){ el.status.textContent = msg; }

    async function loadList(){
      try {
        const res = await fetch('/api/v1/scanner/captures?limit=20');
        const data = await res.json();
        const items = (data && data.data && data.data.items) || [];
        el.list.innerHTML = items.slice().reverse().map(function(it){
          return '<div class="item">'
            + '<div><strong>Atendimento:</strong> <span class="mono">'+it.numeroAtendimento+'</span></div>'
            + '<div><strong>Fonte:</strong> '+it.source+'</div>'
            + '<div><strong>Capturado em:</strong> '+new Date(it.capturedAt).toLocaleString('pt-BR')+'</div>'
            + '</div>';
        }).join('') || '<div class="item">Sem capturas.</div>';
      } catch (err) {
        setStatus('Falha ao carregar histórico.');
      }
    }

    async function save(rawInput){
      const raw = String(rawInput || '').trim();
      if(!raw){ setStatus('Informe um número para capturar.'); return; }
      setStatus('Salvando captura...');
      const res = await fetch('/api/v1/scanner/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ rawInput: raw, source: 'simple-surgery-scanner' })
      });
      const data = await res.json();
      if(!res.ok || !data.ok){
        setStatus((data && data.error) || 'Falha ao salvar captura.');
        return;
      }
      setStatus('Capturado: ' + data.data.numeroAtendimento);
      el.scan.value = '';
      el.manual.value = '';
      await loadList();
    }

    el.btnActivate.addEventListener('click', function(){
      el.scan.focus();
      setStatus('Captura ativa. Leia no scanner e pressione Enter.');
    });

    el.btnSave.addEventListener('click', function(){
      save(el.manual.value || el.scan.value);
    });

    el.btnClear.addEventListener('click', function(){
      el.scan.value=''; el.manual.value=''; setStatus('Campo limpo.');
    });

    el.scan.addEventListener('keydown', function(ev){
      if(ev.key === 'Enter'){
        ev.preventDefault();
        save(el.scan.value);
      }
    });

    loadList();
  </script>
</body>
</html>
"""


def _normalize_attendance(raw: str) -> str:
    normalized = _CAPTURE_RE.sub("", raw or "")
    if len(normalized) < _MIN_LEN or len(normalized) > _MAX_LEN:
        raise ValueError(
            f"Numero de atendimento deve ter entre {_MIN_LEN} e {_MAX_LEN} digitos"
        )
    return normalized


def _read_db() -> dict[str, Any]:
    if not _DATA_FILE.exists():
        return {"items": []}
    try:
        return json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"items": []}


def _write_db(db: dict[str, Any]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    _DATA_FILE.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")


@router.get("/scanner/capture", response_class=HTMLResponse)
def scanner_capture_page() -> str:
    return HTML_PAGE


@router.get("/api/v1/scanner/captures")
def list_scanner_captures(limit: int = Query(default=20, ge=1, le=200)):
    with _FILE_LOCK:
        db = _read_db()
        items = db.get("items", [])
        return {"ok": True, "data": {"items": items[-limit:]}}


@router.post("/api/v1/scanner/capture")
def create_scanner_capture(payload: ScannerCaptureIn):
    raw = str(payload.rawInput or payload.numeroAtendimento or "").strip()
    source = str(payload.source or "simple-surgery-scanner").strip() or "simple-surgery-scanner"

    try:
        normalized = _normalize_attendance(raw)
    except ValueError as err:
        return {"ok": False, "error": str(err), "data": {"rawInput": raw}}

    item = ScannerCaptureOut(
        id=f"cap_{datetime.now(timezone.utc).timestamp():.0f}",
        numeroAtendimento=normalized,
        rawInput=raw,
        source=source,
        capturedAt=datetime.now(timezone.utc).isoformat(),
    )

    with _FILE_LOCK:
        db = _read_db()
        items = db.get("items", [])
        items.append(item.model_dump())
        db["items"] = items[-500:]
        _write_db(db)

    return {"ok": True, "data": item.model_dump()}
