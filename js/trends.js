var App = App || {};

App.trends = (function () {
  var u = App.utils;
  var anchor = u.todayISO();

  var MODE_COLORS = {
    "UPI": "#4C8DFF",
    "Credit Card": "#FF9F45",
    "Debit Card": "#5AD1A6",
    "Cash": "#B18CFF",
  };

  function render() {
    var root = document.getElementById("tab-trends");
    root.innerHTML =
      '<div id="budget-banner"></div>' +
      '<div class="trends-header">' +
      '<button type="button" class="nav-chevron" data-nav="-1">‹</button>' +
      '<div class="banner-period">' + u.escapeHtml(u.monthLabel(anchor)) + "</div>" +
      '<button type="button" class="nav-chevron" data-nav="1">›</button>' +
      "</div>" +
      '<div class="trend-card">' +
      '<h3>Spending by Category</h3>' +
      '<div id="chart-category" class="heatmap-grid"></div>' +
      "</div>" +
      '<div class="trend-card" id="top5-card"></div>' +
      '<div class="trend-card" id="budget-variance-card"></div>' +
      '<div class="trend-card">' +
      '<h3>Income vs Expense (6 months)</h3>' +
      '<div class="legend"><span class="legend-dot income"></span> Income <span class="legend-dot expense"></span> Expense</div>' +
      '<canvas id="chart-6mo" class="chart-canvas"></canvas>' +
      "</div>" +
      '<div class="trend-card">' +
      '<h3>Mode of Payment</h3>' +
      '<div id="payment-legend" class="legend"></div>' +
      '<canvas id="chart-payment" class="chart-canvas chart-donut"></canvas>' +
      "</div>";

    root.querySelectorAll("[data-nav]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        anchor = u.addMonths(anchor, parseInt(btn.getAttribute("data-nav"), 10));
        render();
      });
    });

    renderBudgetBanner();
    getCategoryTotals().then(function (totals) {
      drawCategoryChart(totals);
      renderTop5(totals);
    });
    renderBudgetVariance();
    draw6MonthChart();
    drawPaymentChart();
  }

  function renderBudgetBanner() {
    App.budgets.computeBudgetSummary().then(function (s) {
      var el = document.getElementById("budget-banner");
      if (!el) return;
      el.innerHTML =
        '<div class="banner budget-banner-inner">' +
        '<div class="budget-remaining">' +
        '<div class="stat-label">Remaining (Monthly)</div>' +
        '<div class="stat-value ' + (s.remaining >= 0 ? "income" : "expense") + '" style="font-size:22px;">' + u.formatCurrency(s.remaining) + "</div>" +
        "</div>" +
        '<button type="button" class="budget-planning-link" id="budget-planning-btn">Budget Planning ›</button>' +
        "</div>";
      el.querySelector("#budget-planning-btn").addEventListener("click", function () {
        App.budgets.openPlanningScreen();
      });
    });
  }

  function getCategoryTotals() {
    var start = u.startOfMonth(anchor), end = u.endOfMonth(anchor);
    return App.db.getTransactionsInRange(start, end).then(function (txs) {
      var totals = {};
      txs.forEach(function (t) {
        if (t.type !== "expense") return;
        totals[t.category] = (totals[t.category] || 0) + t.amount;
      });
      return Object.keys(totals)
        .map(function (cat) { return { category: cat, value: totals[cat] }; })
        .sort(function (a, b) { return b.value - a.value; });
    });
  }

  function drawCategoryChart(totals) {
    var items = totals.map(function (t) {
      return { label: t.category, value: t.value };
    });
    App.charts.categoryHeatmap(document.getElementById("chart-category"), items);
  }

  function renderTop5(totals) {
    var card = document.getElementById("top5-card");
    if (!card) return;
    var total = totals.reduce(function (s, t) { return s + t.value; }, 0) || 1;
    var top5 = totals.slice(0, 5);
    card.innerHTML =
      "<h3>Top 5 Categories</h3>" +
      (top5.length
        ? '<div class="item-list">' +
          top5
            .map(function (t, idx) {
              var pct = Math.round((t.value / total) * 100);
              return (
                '<div class="item-row">' +
                '<div class="item-main">' +
                '<div class="item-title">' + (idx + 1) + ". " + u.escapeHtml(t.category) + "</div>" +
                '<div class="item-sub">' + pct + "% of this month's expenses</div>" +
                "</div>" +
                '<div class="item-value">' + u.formatCurrency(t.value) + "</div>" +
                "</div>"
              );
            })
            .join("") +
          "</div>"
        : '<div class="empty-list">No expenses this month.</div>');
  }

  function renderBudgetVariance() {
    var start = u.startOfMonth(anchor), end = u.endOfMonth(anchor);
    var card = document.getElementById("budget-variance-card");
    if (!card) return;
    Promise.all([App.db.getAllBudgets(), App.db.getTransactionsInRange(start, end)]).then(function (r) {
      var budgets = r[0].filter(function (b) { return b.amount > 0; });
      var spentByCategory = {};
      r[1].forEach(function (t) {
        if (t.type !== "expense") return;
        spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount;
      });

      card.innerHTML =
        "<h3>Budget vs Actual</h3>" +
        (budgets.length
          ? '<div class="item-list">' +
            budgets
              .map(function (b) {
                var spent = spentByCategory[b.category] || 0;
                var pct = Math.min(100, Math.round((spent / b.amount) * 100));
                var over = spent > b.amount;
                var variance = u.round2(b.amount - spent);
                return (
                  '<div class="budget-variance-row">' +
                  '<div class="budget-variance-top">' +
                  '<span class="item-title">' + u.escapeHtml(b.category) + "</span>" +
                  '<span class="' + (over ? "expense" : "income") + '">' + (over ? "Over by " : "Under by ") + u.formatCurrency(Math.abs(variance)) + "</span>" +
                  "</div>" +
                  '<div class="progress-track"><div class="progress-fill ' + (over ? "over" : "") + '" style="width:' + pct + '%;"></div></div>' +
                  '<div class="item-sub">' + u.formatCurrency(spent) + " of " + u.formatCurrency(b.amount) + "</div>" +
                  "</div>"
                );
              })
              .join("") +
            "</div>"
          : '<div class="empty-list">No budgets set yet. Tap Budget Planning above to add some.</div>');
    });
  }

  function draw6MonthChart() {
    var months = [];
    for (var i = 5; i >= 0; i--) {
      months.push(u.addMonths(anchor, -i));
    }
    Promise.all(
      months.map(function (m) {
        return App.db.getTransactionsInRange(u.startOfMonth(m), u.endOfMonth(m)).then(function (txs) {
          var income = 0, expense = 0;
          txs.forEach(function (t) {
            if (t.type === "income") income += t.amount;
            else if (t.type === "expense") expense += t.amount;
          });
          return { label: u.shortMonthLabel(m), income: income, expense: expense };
        });
      })
    ).then(function (data) {
      App.charts.groupedBars(document.getElementById("chart-6mo"), data);
    });
  }

  function drawPaymentChart() {
    var start = u.startOfMonth(anchor), end = u.endOfMonth(anchor);
    App.db.getTransactionsInRange(start, end).then(function (txs) {
      var totals = {};
      App.categories.MODES.forEach(function (m) { totals[m] = 0; });
      txs.forEach(function (t) {
        if (t.type !== "expense") return;
        totals[t.mode] = (totals[t.mode] || 0) + t.amount;
      });
      var items = App.categories.MODES.map(function (m) {
        return { label: m, value: totals[m], color: MODE_COLORS[m] };
      });
      App.charts.donut(document.getElementById("chart-payment"), items);

      var total = items.reduce(function (s, i) { return s + i.value; }, 0);
      var legend = document.getElementById("payment-legend");
      legend.innerHTML = items
        .map(function (i) {
          var pct = total ? Math.round((i.value / total) * 100) : 0;
          return (
            '<span class="legend-item"><span class="legend-dot" style="background:' +
            i.color +
            '"></span>' +
            i.label + " " + u.formatCurrency(i.value) + " (" + pct + "%)</span>"
          );
        })
        .join("");
    });
  }

  return {
    render: render,
  };
})();
