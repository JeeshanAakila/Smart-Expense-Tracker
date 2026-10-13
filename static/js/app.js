/**
 * Smart Expense Tracker - Core Application Logic
 * Implements CRUD operations, reactive dashboard filtering, budget alerts, and data exports.
 */

const App = {
  // State
  state: {
    currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    typeFilter: 'all',
    categoryFilter: 'all',
    searchQuery: '',
    sortBy: 'date',
    order: 'desc',
    categories: { income: [], expense: [] },
    editingTransactionId: null,
    deletingTransactionId: null,
    transactions: [],
    summary: null
  },

  // Initialize
  init: async function() {
    this.initTheme();
    this.setupDateSelectors();
    await this.fetchDbStatus();
    await this.fetchCategories();
    this.bindEvents();
    await this.refreshAll();
  },

  initTheme: function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.applyTheme(savedTheme);
  },

  applyTheme: function(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      if (theme === 'dark') {
        toggleBtn.innerHTML = `
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>`;
        toggleBtn.title = "Switch to Light Theme";
      } else {
        toggleBtn.innerHTML = `
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>`;
        toggleBtn.title = "Switch to Dark Theme";
      }
    }
  },

  toggleTheme: function() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
    if (Charts.lastChartData) {
      Charts.renderAll(Charts.lastChartData);
    }
    this.showToast(`Switched to ${nextTheme === 'light' ? 'Light' : 'Dark'} mode!`, 'info');
  },

  setupDateSelectors: function() {
    const monthPicker = document.getElementById('selected-month');
    const budgetMonth = document.getElementById('budget-month-input');
    const txDateInput = document.getElementById('tx-date');

    if (monthPicker) monthPicker.value = this.state.currentMonth;
    if (budgetMonth) budgetMonth.value = this.state.currentMonth;
    if (txDateInput) txDateInput.value = new Date().toISOString().slice(0, 10);
  },

  // Database Connection Status
  fetchDbStatus: async function() {
    try {
      const res = await fetch('/api/db-status');
      const data = await res.json();
      const badge = document.getElementById('db-status-badge');
      if (badge) {
        if (data.is_mysql) {
          badge.innerHTML = `<span class="dot" style="background:#10b981;box-shadow:0 0 8px #10b981;"></span> MySQL Connected`;
          badge.title = "Connected to MySQL production database.";
        } else {
          badge.innerHTML = `<span class="dot" style="background:#38bdf8;box-shadow:0 0 8px #38bdf8;"></span> SQLite Active (Fallback)`;
          badge.title = "Running on SQLite storage. Switch to MySQL in .env when ready!";
        }
      }
    } catch (err) {
      console.warn("Could not check DB status:", err);
    }
  },

  // Fetch Category Definitions
  fetchCategories: async function() {
    try {
      const res = await fetch('/api/categories');
      this.state.categories = await res.json();
      this.updateCategoryDropdownFilter();
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  },

  updateCategoryDropdownFilter: function() {
    const filterSelect = document.getElementById('filter-category');
    if (!filterSelect) return;

    let allCats = new Set([...this.state.categories.expense, ...this.state.categories.income]);
    let html = `<option value="all">All Categories</option>`;
    allCats.forEach(cat => {
      html += `<option value="${cat}">${cat}</option>`;
    });
    filterSelect.innerHTML = html;
  },

  updateFormCategories: function(selectedType, defaultCat = null) {
    const catSelect = document.getElementById('tx-category');
    if (!catSelect) return;

    const list = this.state.categories[selectedType] || [];
    let html = '';
    list.forEach(cat => {
      const isSelected = defaultCat === cat ? 'selected' : '';
      html += `<option value="${cat}" ${isSelected}>${cat}</option>`;
    });
    catSelect.innerHTML = html;
  },

  // Refresh Dashboard
  refreshAll: async function() {
    await Promise.all([
      this.loadSummary(),
      this.loadCharts(),
      this.loadTransactions()
    ]);
  },

  // Load KPI Summary
  loadSummary: async function() {
    try {
      const res = await fetch(`/api/summary?month=${this.state.currentMonth}`);
      if (!res.ok) throw new Error('Failed to load summary');
      const summary = await res.json();
      this.state.summary = summary;
      this.renderKPIs(summary);
      this.renderBudgetAlert(summary);
    } catch (err) {
      this.showToast('Error loading financial summary', 'error');
    }
  },

  renderKPIs: function(summary) {
    // Total Income
    const incomeEl = document.getElementById('kpi-total-income');
    if (incomeEl) incomeEl.textContent = this.formatCurrency(summary.total_income);

    // Total Expenses
    const expenseEl = document.getElementById('kpi-total-expenses');
    if (expenseEl) expenseEl.textContent = this.formatCurrency(summary.total_expenses);

    // Balance
    const balanceEl = document.getElementById('kpi-balance');
    if (balanceEl) {
      balanceEl.textContent = this.formatCurrency(summary.balance);
      balanceEl.className = 'kpi-value ' + (summary.balance >= 0 ? 'amount-income' : 'amount-expense');
    }

    // Budget
    const budgetEl = document.getElementById('kpi-budget-amount');
    const budgetRemainingEl = document.getElementById('kpi-budget-remaining');
    const budgetBar = document.getElementById('kpi-budget-bar');
    const budgetSubtext = document.getElementById('kpi-budget-subtext');

    if (budgetEl) budgetEl.textContent = this.formatCurrency(summary.monthly_budget);
    if (budgetRemainingEl) {
      if (summary.monthly_budget > 0) {
        budgetRemainingEl.textContent = `${this.formatCurrency(summary.budget_remaining)} left`;
      } else {
        budgetRemainingEl.textContent = 'Budget not set';
      }
    }

    if (budgetBar) {
      const pct = Math.min(summary.budget_spent_percent, 100);
      budgetBar.style.width = `${pct}%`;
      budgetBar.className = 'budget-progress-bar';
      if (summary.budget_status === 'warning') budgetBar.classList.add('status-warning');
      if (summary.budget_status === 'exceeded') budgetBar.classList.add('status-exceeded');
    }

    if (budgetSubtext) {
      if (summary.monthly_budget > 0) {
        budgetSubtext.textContent = `${summary.budget_spent_percent}% of monthly budget spent`;
      } else {
        budgetSubtext.textContent = 'Click "Set Budget" to track monthly limits';
      }
    }
  },

  renderBudgetAlert: function(summary) {
    const banner = document.getElementById('budget-alert-banner');
    if (!banner) return;

    banner.className = 'budget-alert-banner';
    let message = '';

    if (summary.monthly_budget === 0) {
      banner.classList.add('budget-alert-not_set');
      message = `💡 No spending budget set for ${this.formatMonthName(summary.month_year)}. Click <strong>"Set Budget"</strong> above to plan your monthly expenses.`;
    } else if (summary.budget_status === 'exceeded') {
      banner.classList.add('budget-alert-exceeded');
      const overspend = Math.abs(summary.budget_remaining);
      message = `🚨 <strong>Budget Exceeded!</strong> You have spent ${summary.budget_spent_percent}% of your limit, exceeding by ${this.formatCurrency(overspend)}.`;
    } else if (summary.budget_status === 'warning') {
      banner.classList.add('budget-alert-warning');
      message = `⚠️ <strong>Attention:</strong> You have reached ${summary.budget_spent_percent}% of your monthly budget. Only ${this.formatCurrency(summary.budget_remaining)} remains.`;
    } else {
      banner.classList.add('budget-alert-safe');
      message = `✨ <strong>Healthy Finances:</strong> You're comfortably within budget! (${summary.budget_spent_percent}% spent, ${this.formatCurrency(summary.budget_remaining)} available).`;
    }

    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span>${message}</span>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="App.openBudgetModal()">Adjust Budget</button>
    `;
  },

  // Load Charts
  loadCharts: async function() {
    try {
      const res = await fetch(`/api/charts?month=${this.state.currentMonth}`);
      if (!res.ok) throw new Error('Failed to load chart data');
      const data = await res.json();
      Charts.renderAll(data);
    } catch (err) {
      console.error('Error loading charts:', err);
    }
  },

  // Load Transactions (CRUD Read)
  loadTransactions: async function() {
    try {
      const params = new URLSearchParams({
        month: this.state.currentMonth,
        sort_by: this.state.sortBy,
        order: this.state.order
      });

      if (this.state.typeFilter !== 'all') {
        params.append('type', this.state.typeFilter);
      }
      if (this.state.categoryFilter !== 'all') {
        params.append('category', this.state.categoryFilter);
      }
      if (this.state.searchQuery.trim()) {
        params.append('search', this.state.searchQuery.trim());
      }

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const transactions = await res.json();
      this.state.transactions = transactions;
      this.renderTransactionsTable(transactions);
    } catch (err) {
      this.showToast('Error loading transactions table', 'error');
    }
  },

  renderTransactionsTable: function(transactions) {
    const tbody = document.getElementById('transactions-table-body');
    const emptyState = document.getElementById('table-empty-state');
    const countEl = document.getElementById('transaction-record-count');

    if (countEl) countEl.textContent = `${transactions.length} record${transactions.length === 1 ? '' : 's'}`;

    if (!transactions || transactions.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    transactions.forEach(tx => {
      const isIncome = tx.type === 'income';
      const formattedAmount = `${isIncome ? '+' : '-'}${this.formatCurrency(tx.amount)}`;
      const amountClass = isIncome ? 'amount-income' : 'amount-expense';
      const catClass = this.getCategoryBadgeClass(tx.category);

      html += `
        <tr id="tx-row-${tx.id}">
          <td style="color:var(--text-secondary);font-size:0.76rem;white-space:nowrap;">
            ${tx.date}
          </td>
          <td>
            <div class="tx-title">${this.escapeHtml(tx.title)}</div>
            ${tx.notes ? `<div class="tx-notes">${this.escapeHtml(tx.notes)}</div>` : ''}
          </td>
          <td>
            <span class="category-badge ${catClass}">${this.escapeHtml(tx.category)}</span>
          </td>
          <td>
            <span style="font-size:0.72rem;font-weight:600;color:${isIncome ? 'var(--income)' : 'var(--expense)'}">
              ${isIncome ? 'Income' : 'Expense'}
            </span>
          </td>
          <td class="amount-cell ${amountClass}">
            ${formattedAmount}
          </td>
          <td style="text-align:right;">
            <div class="action-btn-group" style="justify-content:flex-end;">
              <button class="btn btn-secondary btn-icon" title="Edit Record" onclick="App.openEditModal(${tx.id})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn btn-danger btn-icon" title="Delete Record" onclick="App.openDeleteModal(${tx.id})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    if (tbody) tbody.innerHTML = html;
  },

  // ==================== MODALS & FORM ACTIONS ====================

  openCreateModal: function() {
    this.state.editingTransactionId = null;
    document.getElementById('tx-modal-title').textContent = 'Add Transaction';
    document.getElementById('tx-form').reset();
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    
    // Set default type to expense
    document.getElementById('tx-type-expense').checked = true;
    this.updateFormCategories('expense');

    this.openModal('transaction-modal');
  },

  openEditModal: async function(transactionId) {
    try {
      const res = await fetch(`/api/transactions/${transactionId}`);
      if (!res.ok) throw new Error('Transaction not found');
      const tx = await res.json();

      this.state.editingTransactionId = tx.id;
      document.getElementById('tx-modal-title').textContent = 'Edit Transaction';
      document.getElementById('tx-title').value = tx.title;
      document.getElementById('tx-amount').value = tx.amount;
      document.getElementById('tx-date').value = tx.date;
      document.getElementById('tx-notes').value = tx.notes || '';

      if (tx.type === 'income') {
        document.getElementById('tx-type-income').checked = true;
      } else {
        document.getElementById('tx-type-expense').checked = true;
      }

      this.updateFormCategories(tx.type, tx.category);
      this.openModal('transaction-modal');
    } catch (err) {
      this.showToast('Failed to load transaction details', 'error');
    }
  },

  saveTransaction: async function(e) {
    e.preventDefault();
    const type = document.querySelector('input[name="tx-type"]:checked').value;
    const title = document.getElementById('tx-title').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const category = document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;
    const notes = document.getElementById('tx-notes').value.trim() || null;

    if (!title || isNaN(amount) || amount <= 0 || !category || !date) {
      this.showToast('Please fill in all required fields with valid values.', 'warning');
      return;
    }

    const payload = { title, amount, type, category, date, notes };
    const isEdit = this.state.editingTransactionId !== null;
    const url = isEdit ? `/api/transactions/${this.state.editingTransactionId}` : '/api/transactions';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Save failed');
      }

      this.closeModal('transaction-modal');
      this.showToast(isEdit ? 'Transaction updated successfully!' : 'New transaction added!', 'success');
      await this.refreshAll();
    } catch (err) {
      this.showToast(err.message || 'Error saving transaction', 'error');
    }
  },

  openDeleteModal: function(transactionId) {
    this.state.deletingTransactionId = transactionId;
    this.openModal('delete-modal');
  },

  confirmDelete: async function() {
    const id = this.state.deletingTransactionId;
    if (!id) return;

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');

      this.closeModal('delete-modal');
      this.showToast('Transaction successfully deleted.', 'success');
      await this.refreshAll();
    } catch (err) {
      this.showToast('Error deleting transaction', 'error');
    } finally {
      this.state.deletingTransactionId = null;
    }
  },

  openBudgetModal: function() {
    const month = this.state.currentMonth;
    document.getElementById('budget-month-input').value = month;
    const currentBudget = this.state.summary ? this.state.summary.monthly_budget : 0;
    document.getElementById('budget-amount-input').value = currentBudget > 0 ? currentBudget : '';
    this.openModal('budget-modal');
  },

  saveBudget: async function(e) {
    e.preventDefault();
    const month_year = document.getElementById('budget-month-input').value;
    const total_budget = parseFloat(document.getElementById('budget-amount-input').value);

    if (!month_year || isNaN(total_budget) || total_budget < 0) {
      this.showToast('Please provide a valid budget amount.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year, total_budget })
      });

      if (!res.ok) throw new Error('Failed to update budget');

      this.closeModal('budget-modal');
      this.showToast(`Budget for ${this.formatMonthName(month_year)} set to ${this.formatCurrency(total_budget)}!`, 'success');
      await this.refreshAll();
    } catch (err) {
      this.showToast('Error updating budget', 'error');
    }
  },

  // Export Data
  exportData: function(format) {
    const month = this.state.currentMonth;
    const url = `/api/export/${format}?month=${month}`;
    window.location.href = url;
    this.closeExportDropdown();
    this.showToast(`Exporting ${format.toUpperCase()} report...`, 'success');
  },

  toggleExportDropdown: function() {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown) dropdown.classList.toggle('open');
  },

  closeExportDropdown: function() {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  },

  // Modal Helpers
  openModal: function(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  },

  closeModal: function(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  },

  // Event Listeners
  bindEvents: function() {
    // Month picker change
    const monthPicker = document.getElementById('selected-month');
    if (monthPicker) {
      monthPicker.addEventListener('change', (e) => {
        this.state.currentMonth = e.target.value;
        this.refreshAll();
      });
    }

    // Search input (debounce)
    let searchTimeout;
    const searchInput = document.getElementById('search-transactions');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.state.searchQuery = e.target.value;
          this.loadTransactions();
        }, 250);
      });
    }

    // Type filter pills
    document.querySelectorAll('.type-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.type-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.typeFilter = btn.dataset.type;
        this.loadTransactions();
      });
    });

    // Category filter dropdown
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.state.categoryFilter = e.target.value;
        this.loadTransactions();
      });
    }

    // Sort order dropdown
    const sortSelect = document.getElementById('sort-transactions');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const [field, order] = e.target.value.split('-');
        this.state.sortBy = field;
        this.state.order = order;
        this.loadTransactions();
      });
    }

    // Modal type radio toggle (Income/Expense updates category options)
    document.querySelectorAll('input[name="tx-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.updateFormCategories(e.target.value);
      });
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
      const dropdown = document.getElementById('export-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });
  },

  // Utilities
  formatCurrency: function(num) {
    if (num === null || num === undefined) return '$0.00';
    return '$' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatMonthName: function(monthYear) {
    if (!monthYear) return '';
    const [year, month] = monthYear.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },

  getCategoryBadgeClass: function(category) {
    const map = {
      'Food': 'cat-food',
      'Transport': 'cat-transport',
      'Education': 'cat-education',
      'Bills': 'cat-bills',
      'Salary': 'cat-salary',
      'Freelance': 'cat-freelance',
      'Investments': 'cat-investments',
      'Entertainment': 'cat-entertainment',
      'Shopping': 'cat-shopping',
      'Health': 'cat-health'
    };
    return map[category] || 'cat-other';
  },

  escapeHtml: function(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  showToast: function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
