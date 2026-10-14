import os
import io
import csv
import json
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import engine, Base, SessionLocal, get_db, get_db_status
from app.models import Transaction, Budget
from app.schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    BudgetCreate,
    BudgetResponse,
    FinancialSummary
)
from app import crud
from app.seed_data import seed_initial_data

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Seed sample data on startup if database is empty
with SessionLocal() as db_session:
    seed_initial_data(db_session)

app = FastAPI(
    title="Smart Expense Tracker API",
    description="REST API for Smart Expense Tracker web application using FastAPI and SQLAlchemy",
    version="1.0.0"
)

# Enable CORS for flexible integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Status Endpoint
@app.get("/api/db-status")
def db_status():
    return get_db_status()

# Default categories list
CATEGORIES = {
    "income": ["Salary", "Freelance", "Investments", "Business", "Gifts", "Other Income"],
    "expense": ["Food", "Transport", "Education", "Bills", "Entertainment", "Shopping", "Health", "Housing", "Other Expense"]
}

@app.get("/api/categories")
def get_categories():
    return CATEGORIES

# ==================== TRANSACTION CRUD ====================

@app.post("/api/transactions", response_model=TransactionResponse, status_code=201)
def add_transaction(transaction: TransactionCreate, db: Session = Depends(get_db)):
    """Create a new income or expense transaction."""
    return crud.create_transaction(db, transaction)

@app.get("/api/transactions", response_model=List[TransactionResponse])
def list_transactions(
    type: Optional[str] = Query(None, description="Filter by 'income' or 'expense'"),
    category: Optional[str] = Query(None, description="Filter by category"),
    month: Optional[str] = Query(None, description="Filter by month (YYYY-MM)"),
    date: Optional[str] = Query(None, description="Filter by exact date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search term for title, notes, or date"),
    sort_by: str = Query("date", description="Sort by field: date, amount, title"),
    order: str = Query("desc", description="Sort order: asc or desc"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Retrieve transaction records with flexible filtering and sorting."""
    return crud.get_transactions(
        db=db,
        type_filter=type,
        category_filter=category,
        month_filter=month,
        date_filter=date,
        search_query=search,
        sort_by=sort_by,
        order=order,
        limit=limit,
        offset=offset
    )

@app.get("/api/transactions/{transaction_id}", response_model=TransactionResponse)
def get_single_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Get transaction details by ID."""
    tx = crud.get_transaction_by_id(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx

@app.put("/api/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: int, updates: TransactionUpdate, db: Session = Depends(get_db)):
    """Update existing transaction details."""
    updated = crud.update_transaction(db, transaction_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return updated

@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Delete a transaction."""
    success = crud.delete_transaction(db, transaction_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction successfully deleted", "id": transaction_id}

@app.delete("/api/data")
def reset_all_data(db: Session = Depends(get_db)):
    """Permanently delete all transactions and budgets from the active database."""
    transactions_deleted = db.query(Transaction).delete(synchronize_session=False)
    budgets_deleted = db.query(Budget).delete(synchronize_session=False)
    db.commit()
    return {
        "message": "All transaction and budget data was deleted.",
        "transactions_deleted": transactions_deleted,
        "budgets_deleted": budgets_deleted
    }

# ==================== BUDGET MANAGEMENT ====================

@app.get("/api/budget", response_model=Optional[BudgetResponse])
def get_budget(month: Optional[str] = Query(None, description="Month format: YYYY-MM"), db: Session = Depends(get_db)):
    """Get budget for a specific month (defaults to current month)."""
    if not month:
        month = datetime.now().strftime("%Y-%m")
    budget = crud.get_budget_by_month(db, month)
    return budget

@app.post("/api/budget", response_model=BudgetResponse)
def set_budget(budget_data: BudgetCreate, db: Session = Depends(get_db)):
    """Set or update monthly budget."""
    return crud.set_monthly_budget(db, budget_data)

# ==================== SUMMARY & CHARTS ====================

@app.get("/api/summary", response_model=FinancialSummary)
def get_summary(month: Optional[str] = Query(None, description="Month format: YYYY-MM"), db: Session = Depends(get_db)):
    """Calculate total income, expenses, balance, and budget progress."""
    return crud.get_financial_summary(db, month)

@app.get("/api/charts")
def get_charts(month: Optional[str] = Query(None, description="Month format: YYYY-MM"), db: Session = Depends(get_db)):
    """Get formatted data for Plotly charts (pie/donut breakdown, daily timeline, 6-month trend)."""
    return crud.get_chart_data(db, month)

# ==================== EXPORT DATA ====================

@app.get("/api/export/csv")
def export_csv(
    month: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Export transactions to CSV file."""
    txs = crud.get_transactions(db, type_filter=type, month_filter=month, limit=10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Title", "Amount", "Type", "Category", "Date", "Notes", "Created At"])
    
    for tx in txs:
        writer.writerow([
            tx.id,
            tx.title,
            f"{tx.amount:.2f}",
            tx.type,
            tx.category,
            tx.date.strftime("%Y-%m-%d"),
            tx.notes or "",
            tx.created_at.strftime("%Y-%m-%d %H:%M:%S") if tx.created_at else ""
        ])
    
    output.seek(0)
    filename = f"expense_tracker_export_{month or 'all'}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/export/json")
def export_json(
    month: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Export transactions and summary to JSON."""
    txs = crud.get_transactions(db, month_filter=month, limit=10000)
    summary = crud.get_financial_summary(db, month)
    
    data = {
        "export_date": datetime.now().isoformat(),
        "summary": summary,
        "transactions": [
            {
                "id": tx.id,
                "title": tx.title,
                "amount": tx.amount,
                "type": tx.type,
                "category": tx.category,
                "date": tx.date.strftime("%Y-%m-%d"),
                "notes": tx.notes
            }
            for tx in txs
        ]
    }
    
    json_bytes = json.dumps(data, indent=2).encode("utf-8")
    filename = f"expense_tracker_export_{month or 'all'}.json"
    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================== STATIC & FRONTEND ====================

static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Smart Expense Tracker Backend running. Frontend index.html not found."}
