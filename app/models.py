from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text
from datetime import datetime
from app.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(150), nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String(20), nullable=False, index=True) # 'income' or 'expense'
    category = Column(String(50), nullable=False, index=True) # e.g. Food, Transport, Education, Bills, Salary, Freelance
    date = Column(Date, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    month_year = Column(String(7), unique=True, nullable=False, index=True) # Format: YYYY-MM
    total_budget = Column(Float, nullable=False, default=0.0)
    category_budgets = Column(Text, nullable=True) # JSON string representation
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
