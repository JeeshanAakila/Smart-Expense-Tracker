# 📊 Smart Expense Tracker

> A personal finance web application built according to the **Smart Expense Tracker** project proposal.

---

## 🌟 1. Introduction
**Smart Expense Tracker** is a modern web application designed to help users manage their daily income and expenses. Users can record transactions, monitor their spending, set monthly budgets, and view their financial summaries through an intuitive, high-performance dashboard.

## 🎯 2. Problem Statement
Managing daily expenses manually can be difficult and time-consuming. People may forget to record transactions or exceed their budgets without realizing it. Therefore, a simple digital system is needed to manage personal expenses efficiently and prevent overspending.

## 🚀 3. Aim
To develop a user-friendly web application that helps users manage income and expenses using comprehensive **CRUD** (Create, Read, Update, Delete) operations.

## 📌 4. Objectives
- **Add and manage** income and expense records.
- **View, update, and delete** transaction details with instant UI feedback.
- **Store transaction data** in a **MySQL** database (with seamless SQLAlchemy integration and automatic SQLite fallback).
- **Calculate** total income, total expenses, and remaining balance automatically.
- **Display expense summaries and charts** with interactive Plotly visualizations.
- **Help users monitor monthly budgets** with visual health meters and warning banners.

---

## 💎 5. Main Features & Functionality
- ➕ **Add New Transactions**: Easily log income (salary, freelance, investments) or expenses (food, transport, bills, education).
- 📋 **View All Transaction Records**: Real-time searchable and filterable ledger of all transactions.
- ✏️ **Update Existing Records**: Edit transaction title, amount, category, date, or notes with modal dialogues.
- 🗑️ **Delete Unwanted Transactions**: One-click removal with confirmation protection.
- 🏷️ **Categorize Transactions**: Pre-configured categories (Food, Transport, Education, Bills, Salary, Freelance, etc.) with custom color badges.
- 📈 **KPI Financial Dashboard**: Real-time display of **Total Income**, **Total Expenses**, and **Net Remaining Balance**.
- 🎯 **Monthly Budget Tracking**: Set spending limits per month; receive visual status badges and alert banners when approaching (80%) or exceeding (100%) limits.
- 📊 **Interactive Plotly Visualizations**:
  - **Expense Category Breakdown**: Interactive Donut chart.
  - **Daily Cash Flow**: Grouped income vs. expense timeline.
  - **6-Month Trend Overview**: Comparative historical bar and budget benchmark chart.
- 💾 **Data Export**: One-click export to **CSV** and **JSON** formats.
- 🔍 **Live Search & Sorting**: Real-time text search and sorting by date or amount.
- 🧠 **Smart Categorization**: Suggests categories from transaction descriptions, learns manual category choices, and lets you manage learned rules.
- 🔔 **Unusual Spending Alerts**: Detects unusually large category expenses, stores recent alerts in the browser, and allows alerts to be disabled in Settings.
- 📅 **Weekly Spending Summary**: Compares this week with last week and highlights category changes, top category, highest expense, and daily average.
- 🖨️ **Print-Friendly Monthly Report**: Generates an A4-ready report with monthly totals, category breakdown, and the full transaction list.

New category rules, unusual-spending alerts, and alert preferences are stored in the browser's `localStorage`. Weekly summaries and print reports are calculated from the transaction history in the configured database.
The Settings panel also supports display-currency selection (amounts are not converted) and resetting data. Resetting requires typing `RESET` and permanently deletes all transactions and budgets from the active database, along with the app's saved browser rules, alerts, currency, and theme preferences. The month arrows move the dashboard to the previous or next month.

---

## 🛠️ 6. Technologies Used
- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphism & Obsidian Dark Theme), JavaScript (ES6+)
- **Backend**: Python **FastAPI** (High-performance ASGI REST API)
- **Database**: **MySQL** (Relational database management system)
- **Database Integration**: **SQLAlchemy** (ORM) & **PyMySQL**
- **Charts & Visualizations**: **Plotly.js**
- **Development Tool**: **Google Antigravity**

---

## 🔄 7. CRUD Operations Overview

| Operation | HTTP Method | API Endpoint | Description |
|---|---|---|---|
| **Create** | `POST` | `/api/transactions` | Add a new income or expense transaction |
| **Read** | `GET` | `/api/transactions` | View and filter saved transactions |
| **Read Single** | `GET` | `/api/transactions/{id}` | Retrieve specific transaction details |
| **Update** | `PUT` | `/api/transactions/{id}` | Edit and save existing transaction changes |
| **Delete** | `DELETE` | `/api/transactions/{id}` | Remove unwanted transaction record |

### Additional API Endpoints
- `GET /api/summary`: Retrieve computed financial summary (income, expenses, balance, budget tracking).
- `GET /api/charts`: Retrieve aggregated data formatted for Plotly visualizations.
- `GET /api/budget`: Retrieve monthly budget target.
- `POST /api/budget`: Create or update monthly budget target.
- `GET /api/export/csv`: Export transactions to CSV spreadsheet.
- `GET /api/export/json`: Export transactions to structured JSON.
- `GET /api/db-status`: Inspect active database engine status.

---

## 📁 Project Structure

```
Demo project/
├── app/
│   ├── __init__.py
│   ├── database.py         # SQLAlchemy engine, session maker, MySQL & SQLite fallback
│   ├── models.py           # SQLAlchemy Transaction and Budget models
│   ├── schemas.py          # Pydantic data validation schemas
│   ├── crud.py             # Database CRUD logic & financial calculations
│   ├── seed_data.py        # Realistic initial sample transaction seeder
│   └── main.py             # FastAPI REST API, static files, and routing
├── static/
│   ├── css/
│   │   └── style.css       # Custom design system with glassmorphic cards
│   ├── js/
│   │   ├── app.js          # Core frontend application & CRUD logic
│   │   └── charts.js       # Plotly chart renderers & responsive hooks
│   └── index.html          # Responsive single-page application dashboard
├── .env                    # Active environment configuration
├── .env.example            # Environment variables template
├── requirements.txt        # Python package dependencies
├── run.py                  # One-click startup script
├── schema.sql              # Pure MySQL DDL database schema & initial data
├── setup_mysql.py          # Optional MySQL automated database setup helper
└── README.md               # Documentation matching the proposal
```

---

## ⚡ 8. Quick Start Guide

### Step 1: Clone / Open Project
Navigate to the project folder:
```bash
cd "c:\Demo project"
```

### Step 2: Install Dependencies
Install all required Python packages:
```bash
pip install -r requirements.txt
```

### Step 3: Run Application
Start the application server:
```bash
python run.py
```
Or with uvicorn directly:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser and navigate to:
- 🌐 **Dashboard UI**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- 📚 **Swagger Interactive Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🗄️ 9. Database Configuration (MySQL & SQLite)

The application is configured to connect to MySQL as specified in the proposal. It includes smart auto-fallback:
- If MySQL is running locally, it connects to MySQL.
- If MySQL is offline or not yet started, it gracefully uses local SQLite so the application works out-of-the-box immediately without crashes.

### Setting up MySQL (e.g. XAMPP, MySQL Server, Docker):
1. Start your MySQL service (e.g., via XAMPP Control Panel or Windows Services).
2. Edit `.env` to match your MySQL credentials:
   ```env
   DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/expense_tracker
   FALLBACK_TO_SQLITE=true
   ```
3. Run the automated database setup script:
   ```bash
   python setup_mysql.py
   ```
   Or import `schema.sql` directly into phpMyAdmin / MySQL Workbench.
4. Restart the app (`python run.py`) — the dashboard will display **"MySQL Connected"** with a live status indicator!

---

## 🏁 10. Conclusion & Expected Outcome
Smart Expense Tracker provides a comprehensive, responsive, and visually appealing solution for personal finance management. It fulfills all requirements from the project proposal, demonstrating practical implementation of **Python development**, **FastAPI REST APIs**, **SQLAlchemy ORM**, **MySQL database operations**, **Plotly visualizations**, and full **CRUD workflows**.
