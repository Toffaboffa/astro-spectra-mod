"""FastAPI entrypoint (placeholder).

Step 2+: implement routes:
  - POST /analyze
  - GET /library/search
  - GET /library/filters
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Astro Spectra Mod API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}
