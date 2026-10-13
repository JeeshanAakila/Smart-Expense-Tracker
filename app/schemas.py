from pydantic import BaseModel, Field
import datetime as dt
from typing import Optional, List, Dict, Any

class TransactionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150, description="Transaction title/payee")
    amount: float = Field(..., gt=0, description="Amount must be greater than zero")
    type: str = Field(..., pattern="^(income|expense)$", description="Type must be 'income' or 'expense'")
    category: str = Field(..., min_length=1, max_length=50, description="Transaction category")
    date: dt.date = Field(..., description="Date of transaction (YYYY-MM-DD)")
    notes: Optional[str] = Field(None, description="Optional extra details or tags")

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[str] = Field(None, pattern="^(income|expense)$")
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    date: Optional[dt.date] = None
    notes: Optional[str] = None

class TransactionResponse(TransactionBase):
    id: int
    created_at: Optional[dt.datetime] = None
    updated_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True

class BudgetBase(BaseModel):
    month_year: str = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="Format: YYYY-MM")
    total_budget: float = Field(..., ge=0, description="Monthly spending budget")
    category_budgets: Optional[str] = None

class BudgetCreate(BudgetBase):
    pass

class BudgetResponse(BudgetBase):
    id: int
    created_at: Optional[dt.datetime] = None
    updated_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True

class CategorySummary(BaseModel):
    category: str
    amount: float
    percentage: float
    count: int

class FinancialSummary(BaseModel):
    month_year: str
    total_income: float
    total_expenses: float
    balance: float
    monthly_budget: float
    budget_remaining: float
    budget_spent_percent: float
    budget_status: str # 'safe', 'warning', 'exceeded'
    expense_categories: List[CategorySummary]
    income_categories: List[CategorySummary]
    transaction_count: int
