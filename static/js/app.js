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
    historyTransactions: [],
    historyLoaded: false,
    summary: null,
    learnedRules: [],
    unusualAlerts: [],
    unusualAlertsEnabled: true,
    categoryManuallyPicked: false,
    alertBaseline: null
  },

  // Initialize
  init: async function() {
    this.initTheme();
    this.loadLocalFeatures();
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

  getCategorySuggestion: function(description, type) {
    const text = description.toLocaleLowerCase();
    const eligible = this.state.categories[type] || [];
    const learned = [...this.state.learnedRules]
      .filter(rule => rule.type === type && eligible.includes(rule.category))
      .sort((a, b) => b.keyword.length - a.keyword.length);
    const learnedMatch = learned.find(rule => text.includes(rule.keyword.toLocaleLowerCase()));
    if (learnedMatch) return { category: learnedMatch.category, learned: true };

    const builtInRules = [
      { category: 'Food', type: 'expense', keywords: ['keells', 'cargills', 'arpico', 'grocery', 'restaurant', 'lunch', 'dinner', 'cafe'] },
      { category: 'Transport', type: 'expense', keywords: ['uber', 'pickme', 'bus', 'train', 'fuel', 'petrol'] },
      { category: 'Bills', type: 'expense', keywords: ['electricity', 'water', 'rent', 'internet', 'dialog', 'mobitel', 'slt'] },
      { category: 'Education', type: 'expense', keywords: ['course', 'tuition', 'books', 'school'] },
      { category: 'Salary', type: 'income', keywords: ['salary'] }
    ];
    for (const rule of builtInRules) {
      if (rule.type === type && eligible.includes(rule.category) && rule.keywords.some(keyword => text.includes(keyword))) {
        return { category: rule.category, learned: false };
      }
    }
    return null;
  },

  suggestCategory: function() {
    if (this.state.categoryManuallyPicked) return;
    const description = document.getElementById('tx-title').value.trim();
    const type = document.querySelector('input[name="tx-type"]:checked').value;
    const hint = document.getElementById('category-suggestion-hint');
    const select = document.getElementById('tx-category');
    const suggestion = description ? this.getCategorySuggestion(description, type) : null;
    if (!suggestion || !select) {
      if (hint) {
        hint.hidden = true;
        hint.textContent = '';
      }
      return;
    }
    select.value = suggestion.category;
    if (hint) {
      hint.textContent = `${suggestion.learned ? 'Learned rule' : 'Auto-selected'}: ${suggestion.category} — you can change this.`;
      hint.hidden = false;
    }
  },

  resetCategorySuggestion: function() {
    this.state.categoryManuallyPicked = false;
    const hint = document.getElementById('category-suggestion-hint');
    if (hint) {
      hint.hidden = true;
      hint.textContent = '';
    }
  },

  // Refresh Dashboard
  refreshAll: async function() {
    await Promise.all([
      this.loadSummary(),
      this.loadCharts(),
      this.loadTransactions(),
      this.loadHistoryTransactions()
    ]);
  },

  loadHistoryTransactions: async function() {
    try {
      const pageSize = 500;
      const transactions = [];
      let offset = 0;
      while (true) {
        const res = await fetch(`/api/transactions?sort_by=date&order=desc&limit=${pageSize}&offset=${offset}`);
        if (!res.ok) throw new Error('Failed to load transaction history');
        const page = await res.json();
        transactions.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      this.state.historyTransactions = transactions;
      this.state.historyLoaded = true;
      this.renderWeeklySummary(transactions);
    } catch (err) {
      console.error('Error loading transaction history:', err);
      this.showToast('Could not load transaction history for weekly insights', 'error');
    }
  },

  renderWeeklySummary: function(transactions) {
    const content = document.getElementById('weekly-summary-content');
    const rangeLabel = document.getElementById('weekly-summary-range');
    if (!content) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const formatDate = date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (rangeLabel) rangeLabel.textContent = `${formatDate(thisMonday)} – ${formatDate(new Date(nextMonday.getTime() - 86400000))}`;

    const inRange = (tx, start, end) => {
      const date = new Date(`${tx.date}T00:00:00`);
      return tx.type === 'expense' && date >= start && date < end;
    };
    const thisWeek = transactions.filter(tx => inRange(tx, thisMonday, nextMonday));
    const lastWeek = transactions.filter(tx => inRange(tx, lastMonday, thisMonday));
    const total = items => items.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const thisTotal = total(thisWeek);
    const lastTotal = total(lastWeek);
    const topCategory = thisWeek.reduce((totals, tx) => {
      totals[tx.category] = (totals[tx.category] || 0) + Number(tx.amount);
      return totals;
    }, {});
    const topEntry = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0];
    const highestExpense = thisWeek.reduce((highest, tx) => !highest || Number(tx.amount) > Number(highest.amount) ? tx : highest, null);
    const daysElapsed = Math.min(7, Math.max(1, Math.floor((today - thisMonday) / 86400000) + 1));
    const dailyAverage = thisTotal / daysElapsed;

    let comparisons = '';
    if (lastWeek.length === 0) {
      comparisons = '<p class="weekly-empty-state">There is no spending data from last week yet. Your week-to-week comparison will appear here once you have some.</p>';
    } else {
      const previousByCategory = lastWeek.reduce((totals, tx) => {
        totals[tx.category] = (totals[tx.category] || 0) + Number(tx.amount);
        return totals;
      }, {});
      const changes = new Set([...Object.keys(previousByCategory), ...Object.keys(topCategory)]);
      const totalDirection = thisTotal <= lastTotal ? 'down' : 'up';
      const totalChange = Math.round(Math.abs((thisTotal - lastTotal) / lastTotal) * 100);
      const changeRows = [`<p class="weekly-change ${totalDirection}">Total spending is ${totalDirection} ${totalChange}% this week</p>`];
      changeRows.push(...[...changes]
        .filter(category => previousByCategory[category] > 0 || topCategory[category] > 0)
        .map(category => {
          const previous = previousByCategory[category];
          const current = topCategory[category] || 0;
          if (!previous) {
            return `<p class="weekly-change new">${this.escapeHtml(category)} spending is new this week</p>`;
          }
          const percent = Math.round(Math.abs((current - previous) / previous) * 100);
          const direction = current <= previous ? 'down' : 'up';
          return `<p class="weekly-change ${direction}">${this.escapeHtml(category)} spending is ${direction} ${percent}% this week</p>`;
        }));
      comparisons = changeRows.join('');
    }

    content.innerHTML = `
      <div class="weekly-metrics">
        <div><span>Total this week</span><strong>${this.formatCurrency(thisTotal)}</strong></div>
        <div><span>Total last week</span><strong>${lastWeek.length ? this.formatCurrency(lastTotal) : '—'}</strong></div>
        <div><span>Top category</span><strong>${topEntry ? this.escapeHtml(topEntry[0]) : '—'}</strong></div>
        <div><span>Highest expense</span><strong>${highestExpense ? this.formatCurrency(highestExpense.amount) : '—'}</strong></div>
        <div><span>Daily average</span><strong>${this.formatCurrency(dailyAverage)}</strong></div>
      </div>
      <div class="weekly-comparisons">${comparisons}</div>
    `;
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
    this.resetCategorySuggestion();
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
      this.resetCategorySuggestion();
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
      if (!isEdit && type === 'expense' && this.state.unusualAlertsEnabled) {
        if (!this.state.historyLoaded) await this.loadHistoryTransactions();
        this.state.alertBaseline = [...this.state.historyTransactions];
      }
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Save failed');
      }

      const savedTransaction = await res.json();
      if (this.state.categoryManuallyPicked) this.saveLearnedRule(title, category, type);
      if (!isEdit && type === 'expense') this.checkUnusualSpending(savedTransaction, this.state.alertBaseline || []);
      this.state.alertBaseline = null;
      this.closeModal('transaction-modal');
      this.showToast(isEdit ? 'Transaction updated successfully!' : 'New transaction added!', 'success');
      await this.refreshAll();
    } catch (err) {
      this.state.alertBaseline = null;
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

  loadLocalFeatures: function() {
    const readStored = (key, fallback) => {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch (err) {
        console.warn(`Could not read local setting "${key}":`, err);
        this.showToast('Some saved browser settings could not be read.', 'warning');
        return fallback;
      }
    };
    const rules = readStored('smart-expense-category-rules', []);
    const alerts = readStored('smart-expense-unusual-alerts', []);
    const settings = readStored('smart-expense-settings', {});
    this.state.learnedRules = Array.isArray(rules)
      ? rules.filter(rule => rule && typeof rule.keyword === 'string' && typeof rule.category === 'string' && typeof rule.type === 'string')
      : [];
    this.state.unusualAlerts = Array.isArray(alerts) ? alerts.slice(0, 30) : [];
    this.state.unusualAlertsEnabled = !settings || settings.unusualAlertsEnabled !== false;
    this.renderNotificationBell();
    this.renderCategoryRules();
  },

  persistLocalValue: function(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Could not save local setting "${key}":`, err);
      this.showToast('Could not save this setting in browser storage.', 'error');
      return false;
    }
  },

  saveLearnedRule: function(description, category, type) {
    const keyword = description.trim().toLocaleLowerCase();
    if (!keyword) return;
    const existing = this.state.learnedRules.find(rule => rule.keyword.toLocaleLowerCase() === keyword && rule.type === type);
    if (existing) {
      existing.category = category;
    } else {
      this.state.learnedRules.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, keyword, category, type });
    }
    this.state.learnedRules = this.state.learnedRules.slice(0, 100);
    if (this.persistLocalValue('smart-expense-category-rules', this.state.learnedRules)) {
      this.renderCategoryRules();
    }
  },

  renderCategoryRules: function() {
    const list = document.getElementById('category-rules-list');
    if (!list) return;
    if (!this.state.learnedRules.length) {
      list.innerHTML = '<p class="rules-empty-state">No learned category rules yet. Choose a category manually for a description to teach the tracker.</p>';
      return;
    }
    list.innerHTML = this.state.learnedRules.map(rule => `
      <div class="category-rule-row">
        <span><strong>${this.escapeHtml(rule.keyword)}</strong><small>${this.escapeHtml(rule.type)} · ${this.escapeHtml(rule.category)}</small></span>
        <button class="btn btn-secondary btn-sm" type="button" data-rule-delete="${this.escapeHtml(rule.id)}" aria-label="Delete rule for ${this.escapeHtml(rule.keyword)}">Delete</button>
      </div>
    `).join('');
  },

  deleteLearnedRule: function(ruleId) {
    this.state.learnedRules = this.state.learnedRules.filter(rule => String(rule.id) !== String(ruleId));
    if (this.persistLocalValue('smart-expense-category-rules', this.state.learnedRules)) {
      this.renderCategoryRules();
      this.showToast('Category rule deleted.', 'success');
    }
  },

  openSettings: function() {
    const toggle = document.getElementById('unusual-alerts-toggle');
    if (toggle) toggle.checked = this.state.unusualAlertsEnabled;
    this.renderCategoryRules();
    this.openModal('settings-modal');
  },

  toggleNotifications: function() {
    const panel = document.getElementById('notification-panel');
    const button = document.getElementById('btn-notifications');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (button) button.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) this.renderNotificationBell();
  },

  renderNotificationBell: function() {
    const count = document.getElementById('notification-count');
    const list = document.getElementById('notification-list');
    const unreadCount = this.state.unusualAlerts.filter(alert => !alert.read).length;
    if (count) {
      count.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      count.hidden = unreadCount === 0;
    }
    if (!list) return;
    if (!this.state.unusualAlerts.length) {
      list.innerHTML = '<p class="notification-empty">No unusual spending alerts yet.</p>';
      return;
    }
    list.innerHTML = this.state.unusualAlerts.map(alert => `
      <div class="notification-item ${alert.read ? '' : 'unread'}">
        <div><strong>${this.escapeHtml(alert.message)}</strong><small>${this.escapeHtml(alert.createdAt || '')}</small></div>
        ${alert.read ? '' : `<button class="text-button" type="button" data-alert-read="${this.escapeHtml(alert.id)}">Mark read</button>`}
      </div>
    `).join('');
  },

  markAlertRead: function(alertId) {
    const alert = this.state.unusualAlerts.find(item => String(item.id) === String(alertId));
    if (!alert) return;
    alert.read = true;
    if (this.persistLocalValue('smart-expense-unusual-alerts', this.state.unusualAlerts)) this.renderNotificationBell();
  },

  markAllAlertsRead: function() {
    this.state.unusualAlerts.forEach(alert => { alert.read = true; });
    if (this.persistLocalValue('smart-expense-unusual-alerts', this.state.unusualAlerts)) this.renderNotificationBell();
  },

  checkUnusualSpending: function(transaction, history) {
    if (!this.state.unusualAlertsEnabled || transaction.type !== 'expense') return;
    const date = transaction.date;
    const previous = history.filter(item =>
      item.type === 'expense' &&
      item.category === transaction.category &&
      item.date < date
    );
    if (previous.length < 3) return;

    const cutoff = new Date(`${date}T00:00:00`);
    cutoff.setMonth(cutoff.getMonth() - 3);
    const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const recent = previous.filter(item => item.date >= cutoffDate);
    const baselineTransactions = recent.length >= 3 ? recent : previous;
    const averageTransaction = baselineTransactions.reduce((sum, item) => sum + Number(item.amount), 0) / baselineTransactions.length;
    const [year, month] = date.split('-').map(Number);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const previousMonthDate = new Date(year, month - 1, 1);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 3);
    const threeMonthStart = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const previousThreeMonths = previous.filter(item => item.date >= threeMonthStart && item.date < monthStart);
    const monthlyTotals = new Map();
    previousThreeMonths.forEach(item => {
      const key = item.date.slice(0, 7);
      monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + Number(item.amount));
    });
    let monthlyAverage = monthlyTotals.size
      ? [...monthlyTotals.values()].reduce((sum, amount) => sum + amount, 0) / 3
      : 0;
    if (monthlyAverage === 0) {
      const allMonthlyTotals = new Map();
      previous.forEach(item => {
        const key = item.date.slice(0, 7);
        allMonthlyTotals.set(key, (allMonthlyTotals.get(key) || 0) + Number(item.amount));
      });
      monthlyAverage = [...allMonthlyTotals.values()].reduce((sum, amount) => sum + amount, 0) / Math.max(1, allMonthlyTotals.size);
    }

    const sameMonthTotal = previous
      .filter(item => item.date.slice(0, 7) === date.slice(0, 7))
      .reduce((sum, item) => sum + Number(item.amount), 0) + Number(transaction.amount);
    const transactionIncrease = averageTransaction > 0 && Number(transaction.amount) > averageTransaction * 2
      ? (Number(transaction.amount) / averageTransaction - 1) * 100
      : 0;
    const monthlyIncrease = monthlyAverage > 0 && sameMonthTotal > monthlyAverage * 1.4
      ? (sameMonthTotal / monthlyAverage - 1) * 100
      : 0;
    if (!transactionIncrease && !monthlyIncrease) return;

    const increase = Math.round(Math.max(transactionIncrease, monthlyIncrease));
    const message = monthlyIncrease >= transactionIncrease
      ? `${transaction.category} spending is ${increase}% higher than your usual.`
      : `Unusually large ${transaction.category} expense: ${increase}% above your usual transaction average.`;
    this.state.unusualAlerts.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      createdAt: new Date().toLocaleString(),
      read: false
    });
    this.state.unusualAlerts = this.state.unusualAlerts.slice(0, 30);
    if (this.persistLocalValue('smart-expense-unusual-alerts', this.state.unusualAlerts)) {
      this.renderNotificationBell();
      this.showToast(message, 'warning');
    }
  },

  printReport: async function() {
    const report = document.getElementById('print-report');
    if (!report) return;
    if (!this.state.historyLoaded) await this.loadHistoryTransactions();
    if (!this.state.historyLoaded) {
      this.showToast('The monthly report could not be prepared because transaction history did not load.', 'error');
      return;
    }
    const month = this.state.currentMonth;
    const monthTransactions = this.state.historyTransactions
      .filter(tx => tx.date.slice(0, 7) === month)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const summary = this.state.summary || {};
    const expenses = monthTransactions.filter(tx => tx.type === 'expense');
    const categoryTotals = expenses.reduce((totals, tx) => {
      totals[tx.category] = (totals[tx.category] || 0) + Number(tx.amount);
      return totals;
    }, {});
    const expenseTotal = expenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const categoryRows = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => `<tr><td>${this.escapeHtml(category)}</td><td>${this.formatCurrency(amount)}</td><td>${expenseTotal ? (amount / expenseTotal * 100).toFixed(1) : '0.0'}%</td></tr>`)
      .join('') || '<tr><td colspan="3">No expenses recorded for this month.</td></tr>';
    const transactionRows = monthTransactions.map(tx => `
      <tr>
        <td>${this.escapeHtml(tx.date)}</td>
        <td>${this.escapeHtml(tx.title)}${tx.notes ? `<small class="print-notes">${this.escapeHtml(tx.notes)}</small>` : ''}</td>
        <td>${this.escapeHtml(tx.category)}</td>
        <td>${this.escapeHtml(tx.type)}</td>
        <td class="print-amount">${this.formatCurrency(tx.amount)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">No transactions recorded for this month.</td></tr>';

    report.innerHTML = `
      <h1>Smart Expense Tracker</h1>
      <h2>Monthly Financial Report — ${this.escapeHtml(this.formatMonthName(month))}</h2>
      <div class="print-summary-grid">
        <div><span>Income</span><strong>${this.formatCurrency(summary.total_income || 0)}</strong></div>
        <div><span>Expenses</span><strong>${this.formatCurrency(summary.total_expenses || 0)}</strong></div>
        <div><span>Balance</span><strong>${this.formatCurrency(summary.balance || 0)}</strong></div>
        <div><span>Budget used</span><strong>${this.formatCurrency(summary.total_expenses || 0)} / ${this.formatCurrency(summary.monthly_budget || 0)} (${Number(summary.budget_spent_percent || 0).toFixed(1)}%)</strong></div>
      </div>
      <h3>Expense Category Breakdown</h3>
      <table class="print-table"><thead><tr><th>Category</th><th>Amount</th><th>Share</th></tr></thead><tbody>${categoryRows}</tbody></table>
      <h3>Transactions</h3>
      <table class="print-table print-transaction-table">
        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th></tr></thead>
        <tbody>${transactionRows}</tbody>
      </table>
    `;
    window.print();
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
        this.resetCategorySuggestion();
        this.suggestCategory();
      });
    });

    const titleInput = document.getElementById('tx-title');
    if (titleInput) titleInput.addEventListener('input', () => this.suggestCategory());

    const categoryInput = document.getElementById('tx-category');
    if (categoryInput) {
      categoryInput.addEventListener('change', () => {
        this.state.categoryManuallyPicked = true;
        const title = titleInput.value.trim();
        const type = document.querySelector('input[name="tx-type"]:checked').value;
        const category = categoryInput.value;
        const hint = document.getElementById('category-suggestion-hint');
        if (title) {
          this.saveLearnedRule(title, category, type);
          if (hint) {
            hint.textContent = `Saved rule: ${category} — this category will be suggested for this description next time.`;
            hint.hidden = false;
          }
        }
      });
    }

    const alertsToggle = document.getElementById('unusual-alerts-toggle');
    if (alertsToggle) {
      alertsToggle.addEventListener('change', () => {
        this.state.unusualAlertsEnabled = alertsToggle.checked;
        this.persistLocalValue('smart-expense-settings', { unusualAlertsEnabled: this.state.unusualAlertsEnabled });
        this.showToast(`Unusual spending alerts ${alertsToggle.checked ? 'enabled' : 'disabled'}.`, 'info');
      });
    }

    const rulesList = document.getElementById('category-rules-list');
    if (rulesList) {
      rulesList.addEventListener('click', event => {
        const button = event.target.closest('[data-rule-delete]');
        if (button) this.deleteLearnedRule(button.dataset.ruleDelete);
      });
    }

    const notificationList = document.getElementById('notification-list');
    if (notificationList) {
      notificationList.addEventListener('click', event => {
        const button = event.target.closest('[data-alert-read]');
        if (button) this.markAlertRead(button.dataset.alertRead);
      });
    }

    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
      const dropdown = document.getElementById('export-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
      const notification = document.getElementById('notification-wrapper');
      if (notification && !notification.contains(e.target)) {
        const panel = document.getElementById('notification-panel');
        const button = document.getElementById('btn-notifications');
        if (panel) panel.hidden = true;
        if (button) button.setAttribute('aria-expanded', 'false');
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
    if (num === null || num === undefined) return 'Rs. 0.00';
    return 'Rs. ' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    if (str === null || str === undefined) return '';
    return String(str)
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
