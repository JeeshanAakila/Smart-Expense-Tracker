import os
import sys
import uvicorn
from dotenv import load_dotenv

load_dotenv()

# Ensure utf-8 encoding on Windows console
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    
    print("=" * 65)
    print(" [*] SMART EXPENSE TRACKER - Starting Server...")
    print(f" [>] Dashboard URL : http://{host}:{port}")
    print(f" [>] Swagger Docs  : http://{host}:{port}/docs")
    print(f" [>] Database Engine: Initializing (MySQL / SQLite fallback)")
    print("=" * 65)
    
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
