/**
 * Smart Expense Tracker - Plotly Charts Integration
 * Implements interactive data visualizations per proposal specifications.
 * Supports clean Light Theme palette and dynamic theme synchronization.
 */

const Charts = {
  activeTimelineView: 'daily', // 'daily' or 'trend'
  lastChartData: null,

  // Palette tokens
  colors: {
    income: '#059669',
    expense: '#e11d48',
    budget: '#d97706',
    pieColors: [
      '#f97316', '#3b82f6', '#a855f7', '#ec4899', 
      '#0284c7', '#eab308', '#059669', '#6366f1', '#64748b'
    ]
  },

  isDark: function() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  },

  currencyCode: function() {
    return App.state.currency || 'LKR';
  },

  // Dynamic Theme Layout Configuration
  getThemeLayout: function(title, extra = {}) {
    const dark = this.isDark();
    const textColor = dark ? '#94a3b8' : '#475569';
    const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    const hoverBg = dark ? '#1e293b' : '#ffffff';
    const hoverText = dark ? '#f8fafc' : '#0f172a';
    const hoverBorder = dark ? 'rgba(255,255,255,0.15)' : '#cbd5e1';

    return {
      title: title ? { text: title, font: { color: hoverText, size: 12, family: 'Inter, -apple-system, sans-serif' } } : false,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: textColor, family: 'Inter, -apple-system, sans-serif', size: 11 },
      margin: { l: 36, r: 16, t: 24, b: 36 },
      autosize: true,
      hoverlabel: {
        bgcolor: hoverBg,
        bordercolor: hoverBorder,
        font: { color: hoverText, family: 'Inter, -apple-system, sans-serif', size: 11 }
      },
      ...extra
    };
  },

  renderAll: function(chartData) {
    if (!chartData) return;
    this.lastChartData = chartData;
    this.renderExpenseBreakdown(chartData.pie_chart);
    if (this.activeTimelineView === 'daily') {
      this.renderDailyTimeline(chartData.daily_timeline);
    } else {
      this.renderSixMonthTrend(chartData.six_month_trend);
    }
  },

  renderExpenseBreakdown: function(pieData) {
    const container = document.getElementById('category-pie-chart');
    if (!container) return;

    if (!pieData || !pieData.labels || pieData.labels.length === 0) {
      container.innerHTML = `
        <div style="display:flex; height:100%; align-items:center; justify-content:center; color:#64748b; font-size:0.9rem;">
          No expense records for selected month.
        </div>`;
      return;
    }

    const dark = this.isDark();
    const currency = this.currencyCode();
    const sliceBorder = dark ? '#111827' : '#ffffff';

    const data = [{
      values: pieData.values,
      labels: pieData.labels,
      type: 'pie',
      hole: 0.62,
      textinfo: 'percent',
      hovertemplate: `<b>%{label}</b><br>${currency} %{value:,.2f} (%{percent})<extra></extra>`,
      marker: {
        colors: this.colors.pieColors,
        line: { color: sliceBorder, width: 2.5 }
      },
      insidetextfont: { color: '#ffffff', size: 10 }
    }];

    const layout = this.getThemeLayout('', {
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0.5,
        y: -0.15,
        xanchor: 'center',
        font: { size: 10, color: dark ? '#94a3b8' : '#475569' }
      },
      margin: { l: 16, r: 16, t: 16, b: 50 }
    });

    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot('category-pie-chart', data, layout, config);
  },

  renderDailyTimeline: function(timelineData) {
    const container = document.getElementById('timeline-chart');
    if (!container) return;

    if (!timelineData || !timelineData.dates || timelineData.dates.length === 0) {
      container.innerHTML = `
        <div style="display:flex; height:100%; align-items:center; justify-content:center; color:#64748b; font-size:0.9rem;">
          No transaction history for selected month.
        </div>`;
      return;
    }

    const dark = this.isDark();
    const currency = this.currencyCode();
    const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    const textColor = dark ? '#94a3b8' : '#64748b';

    const formattedDates = timelineData.dates.map(d => {
      const parts = d.split('-');
      return `${parts[1]}/${parts[2]}`;
    });

    const incomeTrace = {
      x: formattedDates,
      y: timelineData.income,
      name: 'Income',
      type: 'bar',
      hovertemplate: `%{x}<br>Income: ${currency} %{y:,.2f}<extra></extra>`,
      marker: {
        color: this.colors.income,
        line: { color: 'rgba(5, 150, 105, 0.3)', width: 1 }
      }
    };

    const expenseTrace = {
      x: formattedDates,
      y: timelineData.expenses,
      name: 'Expenses',
      type: 'bar',
      hovertemplate: `%{x}<br>Expenses: ${currency} %{y:,.2f}<extra></extra>`,
      marker: {
        color: this.colors.expense,
        line: { color: 'rgba(225, 29, 72, 0.3)', width: 1 }
      }
    };

    const layout = this.getThemeLayout('', {
      barmode: 'group',
      bargap: 0.25,
      bargroupgap: 0.1,
      xaxis: {
        tickfont: { size: 10, color: textColor },
        gridcolor: gridColor,
        zerolinecolor: gridColor
      },
      yaxis: {
        tickfont: { size: 10, color: textColor },
        gridcolor: gridColor,
        zerolinecolor: gridColor,
        tickprefix: `${currency} `
      },
      legend: {
        orientation: 'h',
        x: 0.5,
        y: 1.15,
        xanchor: 'center',
        font: { size: 10, color: dark ? '#cbd5e1' : '#334155' }
      }
    });

    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot('timeline-chart', [incomeTrace, expenseTrace], layout, config);
  },

  renderSixMonthTrend: function(trendData) {
    const container = document.getElementById('timeline-chart');
    if (!container) return;

    if (!trendData || !trendData.months || trendData.months.length === 0) {
      container.innerHTML = `<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#64748b;">No trend records.</div>`;
      return;
    }

    const dark = this.isDark();
    const currency = this.currencyCode();
    const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    const textColor = dark ? '#94a3b8' : '#64748b';

    const incomeTrace = {
      x: trendData.months,
      y: trendData.income,
      name: 'Total Income',
      type: 'bar',
      hovertemplate: `%{x}<br>Income: ${currency} %{y:,.2f}<extra></extra>`,
      marker: { color: this.colors.income }
    };

    const expenseTrace = {
      x: trendData.months,
      y: trendData.expenses,
      name: 'Total Expenses',
      type: 'bar',
      hovertemplate: `%{x}<br>Expenses: ${currency} %{y:,.2f}<extra></extra>`,
      marker: { color: this.colors.expense }
    };

    const budgetTrace = {
      x: trendData.months,
      y: trendData.budgets,
      name: 'Monthly Budget',
      type: 'scatter',
      mode: 'lines+markers',
      hovertemplate: `%{x}<br>Budget: ${currency} %{y:,.2f}<extra></extra>`,
      line: { color: this.colors.budget, width: 3, dash: 'dot' },
      marker: { size: 7, color: this.colors.budget }
    };

    const layout = this.getThemeLayout('', {
      barmode: 'group',
      bargap: 0.3,
      xaxis: {
        tickfont: { size: 10, color: textColor },
        gridcolor: gridColor
      },
      yaxis: {
        tickfont: { size: 10, color: textColor },
        gridcolor: gridColor,
        tickprefix: `${currency} `
      },
      legend: {
        orientation: 'h',
        x: 0.5,
        y: 1.15,
        xanchor: 'center',
        font: { size: 10, color: dark ? '#cbd5e1' : '#334155' }
      }
    });

    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot('timeline-chart', [incomeTrace, expenseTrace, budgetTrace], layout, config);
  },

  switchTimelineView: function(viewType) {
    this.activeTimelineView = viewType;
    document.querySelectorAll('.chart-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewType);
    });
    if (this.lastChartData) {
      if (viewType === 'daily') {
        this.renderDailyTimeline(this.lastChartData.daily_timeline);
      } else {
        this.renderSixMonthTrend(this.lastChartData.six_month_trend);
      }
    }
  }
};

// Automatic resize handler
window.addEventListener('resize', () => {
  const pieEl = document.getElementById('category-pie-chart');
  const lineEl = document.getElementById('timeline-chart');
  if (pieEl && pieEl.data) Plotly.Plots.resize(pieEl);
  if (lineEl && lineEl.data) Plotly.Plots.resize(lineEl);
});
