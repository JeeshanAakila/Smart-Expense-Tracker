from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, cast, String, or_
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from app.models import Transaction, Budget
from app.schemas import TransactionCreate, TransactionUpdate, BudgetCreate

# Month name lookup for natural language date search
_MONTH_NAMES = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12,
}

def _parse_month_name(text: str) -> Optional[int]:
    """Convert a month name (full or abbreviated) to its number, or return None."""
    return _MONTH_NAMES.get(text.lower())

def _or_filters(*filters):
    """Combine multiple SQLAlchemy filter expressions with OR."""
    return or_(*filters)

def create_transaction(db: Session, transaction: TransactionCreate) -> Transaction:
    db_item = Transaction(
        title=transaction.title,
        amount=transaction.amount,
        type=transaction.type,
        category=transaction.category,
        date=transaction.date,
        notes=transaction.notes
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_transactions(
    db: Session,
    type_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    month_filter: Optional[str] = None,
    date_filter: Optional[str] = None,
    search_query: Optional[str] = None,
    sort_by: str = "date",
    order: str = "desc",
    limit: int = 100,
    offset: int = 0
) -> List[Transaction]:
    query = db.query(Transaction)

    if type_filter and type_filter in ("income", "expense"):
        query = query.filter(Transaction.type == type_filter)

    if category_filter and category_filter != "all":
        query = query.filter(Transaction.category == category_filter)

    if month_filter:
        try:
            year, month = map(int, month_filter.split("-"))
            # Filter by year and month
            query = query.filter(
                func.extract('year', Transaction.date) == year,
                func.extract('month', Transaction.date) == month
            )
        except Exception:
            pass

    if date_filter:
        query = query.filter(cast(Transaction.date, String) == date_filter)

    if search_query:
        search_pattern = f"%{search_query}%"
        # Build date string expression that works for both SQLite and MySQL
        date_as_str = func.strftime('%Y-%m-%d', Transaction.date)
        
        # Check if search query is a month name (e.g. "october", "oct")
        month_number = _parse_month_name(search_query.strip())
        
        filters = [
            Transaction.title.ilike(search_pattern),
            Transaction.notes.ilike(search_pattern),
            Transaction.category.ilike(search_pattern),
            date_as_str.ilike(search_pattern),
        ]
        
        if month_number:
            # Match dates in that month (e.g. "october" -> month 10)
            filters.append(
                func.extract('month', Transaction.date) == month_number
            )
        
        query = query.filter(_or_filters(*filters))

    # Sorting
    sort_column = getattr(Transaction, sort_by, Transaction.date)
    if order == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    return query.offset(offset).limit(limit).all()

def get_transaction_by_id(db: Session, transaction_id: int) -> Optional[Transaction]:
    return db.query(Transaction).filter(Transaction.id == transaction_id).first()

def update_transaction(db: Session, transaction_id: int, updates: TransactionUpdate) -> Optional[Transaction]:
    db_item = get_transaction_by_id(db, transaction_id)
    if not db_item:
        return None

    update_data = updates.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(db_item, field, val)

    db_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_transaction(db: Session, transaction_id: int) -> bool:
    db_item = get_transaction_by_id(db, transaction_id)
    if not db_item:
        return False
    db.delete(db_item)
    db.commit()
    return True

def get_budget_by_month(db: Session, month_year: str) -> Optional[Budget]:
    return db.query(Budget).filter(Budget.month_year == month_year).first()

def set_monthly_budget(db: Session, budget_data: BudgetCreate) -> Budget:
    db_budget = get_budget_by_month(db, budget_data.month_year)
    if db_budget:
        db_budget.total_budget = budget_data.total_budget
        if budget_data.category_budgets is not None:
            db_budget.category_budgets = budget_data.category_budgets
        db_budget.updated_at = datetime.utcnow()
    else:
        db_budget = Budget(
            month_year=budget_data.month_year,
            total_budget=budget_data.total_budget,
            category_budgets=budget_data.category_budgets
        )
        db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget

def get_financial_summary(db: Session, month_year: Optional[str] = None) -> Dict[str, Any]:
    if not month_year:
        month_year = datetime.now().strftime("%Y-%m")

    year, month = map(int, month_year.split("-"))

    month_txs = db.query(Transaction).filter(
        func.extract('year', Transaction.date) == year,
        func.extract('month', Transaction.date) == month
    ).all()

    total_income = 0.0
    total_expenses = 0.0
    expense_cat_totals: Dict[str, Dict[str, Any]] = {}
    income_cat_totals: Dict[str, Dict[str, Any]] = {}

    for tx in month_txs:
        amt = float(tx.amount)
        if tx.type == "income":
            total_income += amt
            if tx.category not in income_cat_totals:
                income_cat_totals[tx.category] = {"amount": 0.0, "count": 0}
            income_cat_totals[tx.category]["amount"] += amt
            income_cat_totals[tx.category]["count"] += 1
        elif tx.type == "expense":
            total_expenses += amt
            if tx.category not in expense_cat_totals:
                expense_cat_totals[tx.category] = {"amount": 0.0, "count": 0}
            expense_cat_totals[tx.category]["amount"] += amt
            expense_cat_totals[tx.category]["count"] += 1

    balance = total_income - total_expenses

    # Monthly budget
    budget_record = get_budget_by_month(db, month_year)
    monthly_budget = float(budget_record.total_budget) if budget_record else 0.0

    budget_remaining = monthly_budget - total_expenses
    budget_spent_percent = round((total_expenses / monthly_budget * 100), 1) if monthly_budget > 0 else 0.0

    if monthly_budget == 0:
        budget_status = "not_set"
    elif budget_spent_percent > 100:
        budget_status = "exceeded"
    elif budget_spent_percent >= 80:
        budget_status = "warning"
    else:
        budget_status = "safe"

    # Category breakdowns with percentages
    expense_categories = []
    for cat, data in sorted(expense_cat_totals.items(), key=lambda x: x[1]["amount"], reverse=True):
        cat_pct = round((data["amount"] / total_expenses * 100), 1) if total_expenses > 0 else 0.0
        expense_categories.append({
            "category": cat,
            "amount": round(data["amount"], 2),
            "percentage": cat_pct,
            "count": data["count"]
        })

    income_categories = []
    for cat, data in sorted(income_cat_totals.items(), key=lambda x: x[1]["amount"], reverse=True):
        cat_pct = round((data["amount"] / total_income * 100), 1) if total_income > 0 else 0.0
        income_categories.append({
            "category": cat,
            "amount": round(data["amount"], 2),
            "percentage": cat_pct,
            "count": data["count"]
        })

    return {
        "month_year": month_year,
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "balance": round(balance, 2),
        "monthly_budget": round(monthly_budget, 2),
        "budget_remaining": round(budget_remaining, 2),
        "budget_spent_percent": budget_spent_percent,
        "budget_status": budget_status,
        "expense_categories": expense_categories,
        "income_categories": income_categories,
        "transaction_count": len(month_txs)
    }

def get_chart_data(db: Session, month_year: Optional[str] = None) -> Dict[str, Any]:
    summary = get_financial_summary(db, month_year)
    selected_month = summary["month_year"]
    year, month = map(int, selected_month.split("-"))

    # 1. Category breakdown for expense pie/donut
    expense_pie_labels = [c["category"] for c in summary["expense_categories"]]
    expense_pie_values = [c["amount"] for c in summary["expense_categories"]]

    # 2. Daily timeline for the selected month
    month_txs = db.query(Transaction).filter(
        func.extract('year', Transaction.date) == year,
        func.extract('month', Transaction.date) == month
    ).order_by(Transaction.date.asc()).all()

    daily_data: Dict[str, Dict[str, float]] = {}
    for tx in month_txs:
        d_str = tx.date.strftime("%Y-%m-%d")
        if d_str not in daily_data:
            daily_data[d_str] = {"income": 0.0, "expense": 0.0}
        daily_data[d_str][tx.type] += float(tx.amount)

    sorted_dates = sorted(daily_data.keys())
    daily_labels = sorted_dates
    daily_income = [daily_data[d]["income"] for d in sorted_dates]
    daily_expenses = [daily_data[d]["expense"] for d in sorted_dates]

    # 3. Last 6 months trend comparison
    monthly_trend = []
    current_date = datetime(year, month, 1)
    
    # Generate past 6 months
    past_months = []
    temp_date = current_date
    for _ in range(6):
        past_months.append(temp_date.strftime("%Y-%m"))
        # step back 1 month
        prev_month = temp_date.month - 1
        prev_year = temp_date.year
        if prev_month == 0:
            prev_month = 12
            prev_year -= 1
        temp_date = datetime(prev_year, prev_month, 1)
    past_months.reverse()

    trend_labels = []
    trend_income = []
    trend_expenses = []
    trend_budgets = []

    for m_str in past_months:
        y_val, m_val = map(int, m_str.split("-"))
        m_txs = db.query(Transaction).filter(
            func.extract('year', Transaction.date) == y_val,
            func.extract('month', Transaction.date) == m_val
        ).all()
        inc = sum(float(t.amount) for t in m_txs if t.type == "income")
        exp = sum(float(t.amount) for t in m_txs if t.type == "expense")
        b_rec = get_budget_by_month(db, m_str)
        b_amt = float(b_rec.total_budget) if b_rec else 0.0

        month_display_name = datetime(y_val, m_val, 1).strftime("%b %Y")
        trend_labels.append(month_display_name)
        trend_income.append(round(inc, 2))
        trend_expenses.append(round(exp, 2))
        trend_budgets.append(round(b_amt, 2))

    return {
        "summary": summary,
        "pie_chart": {
            "labels": expense_pie_labels,
            "values": expense_pie_values
        },
        "daily_timeline": {
            "dates": daily_labels,
            "income": daily_income,
            "expenses": daily_expenses
        },
        "six_month_trend": {
            "months": trend_labels,
            "income": trend_income,
            "expenses": trend_expenses,
            "budgets": trend_budgets
        }
    }
