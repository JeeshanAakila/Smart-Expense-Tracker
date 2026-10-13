import logging
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Transaction, Budget

logger = logging.getLogger("SmartExpenseTracker")

def seed_initial_data(db: Session):
    # Check if any transaction exists
    existing_count = db.query(Transaction).count()
    if existing_count > 0:
        return

    logger.info("Database is empty. Seeding initial data...")
    today = date.today()
    current_month_str = today.strftime("%Y-%m")

    # Set default budget for current month
    current_budget = db.query(Budget).filter(Budget.month_year == current_month_str).first()
    if not current_budget:
        budget = Budget(
            month_year=current_month_str,
            total_budget=2400.00
        )
        db.add(budget)

    # Seed diverse realistic transactions for the current month
    day_val = today.day
    sample_records = [
        # Income
        ("Monthly Base Salary", 3800.00, "income", "Salary", today.replace(day=1), "Direct deposit from Tech Solutions Corp"),
        ("Freelance Web Development", 750.00, "income", "Freelance", today.replace(day=min(6, day_val)), "Client project milestone payment"),
        ("Stock Dividend Payout", 120.00, "income", "Investments", today.replace(day=min(10, day_val)), "Quarterly index dividend"),

        # Expenses
        ("Modern Apartment Rent", 950.00, "expense", "Bills", today.replace(day=min(2, day_val)), "Monthly residential lease"),
        ("Organic Grocery Haul", 165.40, "expense", "Food", today.replace(day=min(3, day_val)), "Groceries, dairy and pantry supplies"),
        ("Public Transit Monthly Pass", 75.00, "expense", "Transport", today.replace(day=min(4, day_val)), "Subway and commuter train transit pass"),
        ("Electricity & Water Utility", 112.50, "expense", "Bills", today.replace(day=min(5, day_val)), "Municipal power utility bill"),
        ("Online Programming Bootcamp", 89.99, "expense", "Education", today.replace(day=min(7, day_val)), "Fullstack Python & Cloud certificate"),
        ("Weekend Bistro Dinner", 64.50, "expense", "Food", today.replace(day=min(8, day_val)), "Dinner with colleagues"),
        ("Mobile Carrier & Fiber Internet", 79.99, "expense", "Bills", today.replace(day=min(9, day_val)), "5G Unlimited data and home broadband"),
        ("Automobile Fuel Refill", 48.00, "expense", "Transport", today.replace(day=min(11, day_val)), "Commute petrol refill"),
        ("Books & Technical Journals", 35.00, "expense", "Education", today.replace(day=day_val), "System Architecture reference manual")
    ]

    for title, amount, t_type, cat, t_date, notes in sample_records:
        tx = Transaction(
            title=title,
            amount=amount,
            type=t_type,
            category=cat,
            date=t_date,
            notes=notes
        )
        db.add(tx)

    db.commit()
    logger.info("Initial data successfully seeded!")
