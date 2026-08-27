#!/usr/bin/env python3
"""
vocabulary-app 專用的 Kokoro TTS sidecar。
從 script-kokoro-app/web_app/app.py 精簡而來：只保留英語(美式/英式)的
單句 ONNX 合成功能，拿掉劇本解析、LLM 配音、SSE 串流、MP3 轉檔等與本
app 無關的部分。

啟動：python.exe server.py --port 8090
"""

import argparse
import io
import os
import wave
from pathlib import Path
from typing import Dict

SERVICE_DIR = Path(__file__).parent
MODEL_DIR = SERVICE_DIR / "model"
ONNX_FILE = MODEL_DIR / "kokoro.onnx"
SAMPLE_RATE = 24000

# 完全離線運作：模型與語音包都已在打包時放進 model/，執行期不可連線 Hugging Face
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_HOME", str(MODEL_DIR / "hf-cache"))

import asyncio

import numpy as np
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel

# 只保留美式(a)/英式(b)英語聲音，對應 vocabulary-app/tts.js 裡的清單
ENGLISH_VOICES = {
    "af_heart", "af_bella", "af_sarah",
    "am_adam", "am_michael",
    "bf_emma", "bm_george",
}


def voice_lang(voice_id: str) -> str:
    return voice_id[0] if voice_id[0] in ("a", "b") else "a"


# ── ONNX 推論（改寫自 script-kokoro-app 的 _build_onnx_synth，僅保留英語分支） ──

_onnx_synth = None


def _build_onnx_synth():
    import onnxruntime as ort
    from kokoro import KModel, KPipeline

    if not ONNX_FILE.exists():
        raise RuntimeError(f"找不到語音模型檔：{ONNX_FILE}")

    session = ort.InferenceSession(str(ONNX_FILE))
    kmodel = KModel(repo_id="hexgrad/Kokoro-82M").eval()
    vocab = kmodel.vocab
    pipes: Dict[str, KPipeline] = {}

    def _pipe(lang_code: str):
        if lang_code not in pipes:
            pipes[lang_code] = KPipeline(lang_code=lang_code, model=kmodel)
        return pipes[lang_code]

    def _segment(ps, pack):
        ids = [vocab[p] for p in ps if vocab.get(p) is not None]
        if not ids:
            return None
        outputs = session.run(None, {
            "input_ids": np.array([[0, *ids, 0]], dtype=np.int64),
            "style": pack[len(ps) - 1].numpy(),
            "speed": np.array([1], dtype=np.int32),
        })
        return outputs[0].squeeze()

    def synth(text: str, voice: str) -> np.ndarray:
        lang = voice_lang(voice)
        pipe = _pipe(lang)
        pack = pipe.load_voice(voice)
        chunks = []
        _, tokens = pipe.g2p(text)
        for _, ps, _ in pipe.en_tokenize(tokens):
            if ps:
                segment = _segment(ps, pack)
                if segment is not None:
                    chunks.append(segment)
        return np.concatenate(chunks) if chunks else np.array([], dtype=np.float32)

    return synth


def get_synth():
    global _onnx_synth
    if _onnx_synth is None:
        _onnx_synth = _build_onnx_synth()
    return _onnx_synth


def to_wav_bytes(audio: np.ndarray) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes((audio * 32767).astype(np.int16).tobytes())
    return buf.getvalue()


# ── FastAPI ──────────────────────────────────────────────────────────────

app = FastAPI(title="vocabulary-app TTS sidecar")


class SpeakRequest(BaseModel):
    text: str
    voice_id: str = "af_heart"


@app.on_event("startup")
async def preload_model():
    # 啟動時就把模型載入好, 讓比較慢的首次載入發生在 sidecar 自己的啟動階段,
    # 而不是使用者第一次點喇叭按鈕時卡住.
    get_synth()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/tts")
async def tts(req: SpeakRequest):
    if req.voice_id not in ENGLISH_VOICES:
        raise HTTPException(400, f"未知的語音：{req.voice_id}")
    if not req.text.strip():
        raise HTTPException(400, "缺少要朗讀的文字")

    loop = asyncio.get_running_loop()
    audio = await loop.run_in_executor(None, get_synth(), req.text, req.voice_id)

    if len(audio) == 0:
        raise HTTPException(500, "語音合成沒有產生任何音訊")

    return Response(content=to_wav_bytes(audio), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8090)
    args = parser.parse_args()

    uvicorn.run(app, host="127.0.0.1", port=args.port)
