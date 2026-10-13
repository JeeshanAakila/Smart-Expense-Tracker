import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SmartExpenseTracker")

# Target database configuration from .env
MYSQL_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/expense_tracker")
SQLITE_URL = "sqlite:///./expense_tracker.db"
ALLOW_FALLBACK = os.getenv("FALLBACK_TO_SQLITE", "true").lower() in ("true", "1", "yes")

engine = None
active_dialect = None
db_message = ""

# Attempt connection to MySQL first (per project proposal)
try:
    logger.info(f"Attempting connection to MySQL: {MYSQL_URL.split('@')[-1] if '@' in MYSQL_URL else MYSQL_URL}")
    test_engine = create_engine(
        MYSQL_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={"connect_timeout": 3}
    )
    with test_engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    engine = test_engine
    active_dialect = "MySQL"
    db_message = "Connected to MySQL database."
    logger.info("Successfully connected to MySQL database!")
except Exception as e:
    logger.warning(f"MySQL connection failed: {e}")
    if ALLOW_FALLBACK:
        logger.info("Falling back to local SQLite database (expense_tracker.db)...")
        engine = create_engine(
            SQLITE_URL,
            connect_args={"check_same_thread": False}
        )
        active_dialect = "SQLite"
        db_message = "Running on SQLite (MySQL fallback enabled)."
    else:
        raise ConnectionError(f"Could not connect to MySQL and fallback is disabled: {e}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_status():
    return {
        "engine": active_dialect,
        "message": db_message,
        "is_mysql": active_dialect == "MySQL",
        "fallback_active": active_dialect == "SQLite"
    }
