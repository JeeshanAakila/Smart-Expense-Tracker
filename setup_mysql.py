"""
Utility script to initialize and verify MySQL database connection
Usage: python setup_mysql.py
"""
import os
import pymysql
from dotenv import load_dotenv

load_dotenv()

def init_mysql():
    url = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/expense_tracker")
    print(f"Connecting to MySQL using configured URL: {url}...")
    
    # Parse basic components
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        username = parsed.username or "root"
        password = parsed.password or ""
        host = parsed.hostname or "localhost"
        port = parsed.port or 3306
        db_name = parsed.path.lstrip("/") or "expense_tracker"

        print(f"Attempting connection to MySQL server at {host}:{port} as user '{username}'...")
        conn = pymysql.connect(host=host, port=port, user=username, password=password)
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            print(f"Database `{db_name}` checked/created successfully!")
        conn.close()
        
        print("\nNow creating tables using SQLAlchemy models...")
        from app.database import engine, Base
        from app.models import Transaction, Budget
        Base.metadata.create_all(bind=engine)
        print("All tables ('transactions', 'budgets') successfully created in MySQL!")
        print("\nDone! Start your application with: python run.py\n")

    except Exception as e:
        print(f"\n[!] MySQL Connection Failed: {e}")
        print("Make sure your MySQL server (e.g. XAMPP, MySQL Server, Docker) is running.")
        print("Note: The application has built-in SQLite auto-fallback, so it works immediately without MySQL too!")

if __name__ == "__main__":
    init_mysql()
