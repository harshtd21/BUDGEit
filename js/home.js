var App = App || {};

App.home = (function () {
  var u = App.utils;
  var BOM = String.fromCharCode(0xfeff);
  var EXCEL_ICON_SVG =
    '<svg width="20" height="20" viewBox="0 0 24 24">' +
    '<rect x="3" y="2" width="18" height="20" rx="3" fill="#1F8B4C"/>' +
    '<rect x="6.5" y="5.5" width="11" height="13" fill="none" stroke="#fff" stroke-width="1.2"/>' +
    '<line x1="6.5" y1="9.5" x2="17.5" y2="9.5" stroke="#fff" stroke-width="1.2"/>' +
    '<line x1="6.5" y1="13.5" x2="17.5" y2="13.5" stroke="#fff" stroke-width="1.2"/>' +
    '<line x1="10.5" y1="5.5" x2="10.5" y2="18.5" stroke="#fff" stroke-width="1.2"/>' +
    '<line x1="14.5" y1="5.5" x2="14.5" y2="18.5" stroke="#fff" stroke-width="1.2"/>' +
    "</svg>";
  var mode = "day"; // day | month | ytd
  var anchor = u.todayISO(); // reference date within the current period

  function periodRange() {
    if (mode === "day") return { start: anchor, end: anchor };
    if (mode === "month") return { start: u.startOfMonth(anchor), end: u.endOfMonth(anchor) };
    // ytd: Jan 1 of anchor's year -> today if current year, else Dec 31 of that year
    var yearStart = u.startOfYear(anchor);
    var isCurrentYear = anchor.slice(0, 4) === u.todayISO().slice(0, 4);
    var yearEnd = isCurrentYear ? u.todayISO() : u.endOfYear(anchor);
    return { start: yearStart, end: yearEnd };
  }

  function periodLabel() {
    if (mode === "day") return u.dayLabel(anchor);
    if (mode === "month") return u.monthLabel(anchor);
    var isCurrentYear = anchor.slice(0, 4) === u.todayISO().slice(0, 4);
    return anchor.slice(0, 4) + (isCurrentYear ? " (Year to Date)" : "");
  }

  function navigate(delta) {
    if (mode === "day") anchor = u.addDays(anchor, delta);
    else if (mode === "month") anchor = u.addMonths(anchor, delta);
    else anchor = u.addYears(anchor, delta);
    render();
  }

  function setMode(newMode) {
    mode = newMode;
    render();
  }

  function render() {
    var root = document.getElementById("tab-home");
    var range = periodRange();

    Promise.all([
      App.db.getTransactionsInRange(range.start, range.end),
      App.db.getAllBankAccounts(),
      App.db.getAllCreditCards(),
    ]).then(function (r) {
      var txs = r[0];
      var bankMap = {}, cardMap = {};
      r[1].forEach(function (a) { bankMap[a.id] = a.bankName; });
      r[2].forEach(function (c) { cardMap[c.id] = c.bankName; });
      var income = 0, expense = 0;
      txs.forEach(function (t) {
        if (t.type === "income") income += t.amount;
        else if (t.type === "expense") expense += t.amount;
      });
      var net = u.round2(income - expense);

      var grouped = groupByDate(txs);
      var listHtml = txs.length
        ? grouped
            .map(function (g) {
              var showHeader = mode !== "day";
              return (
                (showHeader ? '<div class="list-date-header">' + u.groupHeaderLabel(g.date) + "</div>" : "") +
                g.items.map(function (t) { return rowHtml(t, bankMap, cardMap); }).join("")
              );
            })
            .join("")
        : '<div class="empty-list">No transactions in this period.</div>';

      root.innerHTML =
        '<div class="home-topbar">' +
        '<button type="button" class="icon-btn" id="export-csv-btn" aria-label="Export to Excel" title="Export to Excel">' + EXCEL_ICON_SVG + '</button>' +
        "</div>" +
        '<div class="banner">' +
        '<div class="banner-toggle">' +
        modeBtn("day", "Day") +
        modeBtn("month", "Month") +
        modeBtn("ytd", "YTD") +
        "</div>" +
        '<div class="banner-nav">' +
        '<button type="button" class="nav-chevron" data-nav="-1">‹</button>' +
        '<div class="banner-period">' + u.escapeHtml(periodLabel()) + "</div>" +
        '<button type="button" class="nav-chevron" data-nav="1">›</button>' +
        "</div>" +
        '<div class="banner-stats">' +
        '<div class="stat"><span class="stat-label">Income</span><span class="stat-value income">' + u.formatCurrency(income) + "</span></div>" +
        '<div class="stat"><span class="stat-label">Expense</span><span class="stat-value expense">' + u.formatCurrency(expense) + "</span></div>" +
        '<div class="stat"><span class="stat-label">Net</span><span class="stat-value ' + (net >= 0 ? "income" : "expense") + '">' + u.formatCurrency(net) + "</span></div>" +
        "</div>" +
        "</div>" +
        '<div class="tx-list">' + listHtml + "</div>";

      root.querySelector("#export-csv-btn").addEventListener("click", exportToExcel);
      root.querySelectorAll("[data-mode]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          setMode(btn.getAttribute("data-mode"));
        });
      });
      root.querySelectorAll("[data-nav]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          navigate(parseInt(btn.getAttribute("data-nav"), 10));
        });
      });
      root.querySelectorAll("[data-tx-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var tx = txs.find(function (t) { return t.id === row.getAttribute("data-tx-id"); });
          if (!tx) return;
          if (tx.type === "transfer") App.forms.openTransferForm(tx);
          else App.forms.openTransactionForm(tx.type, tx);
        });
      });
    });
  }

  function modeBtn(val, label) {
    return '<button type="button" class="toggle-btn' + (mode === val ? " toggle-selected" : "") + '" data-mode="' + val + '">' + label + "</button>";
  }

  function groupByDate(txs) {
    var map = {};
    var order = [];
    txs.forEach(function (t) {
      if (!map[t.date]) {
        map[t.date] = [];
        order.push(t.date);
      }
      map[t.date].push(t);
    });
    return order.map(function (date) {
      return { date: date, items: map[date] };
    });
  }

  function rowHtml(t, bankMap, cardMap) {
    if (t.type === "transfer") {
      var fromLabel = t.from === "Bank Account" ? (bankMap[t.fromAccountId] || "Bank Account") : "Bank Refund";
      var toLabel = t.to === "Bank Account" ? (bankMap[t.toAccountId] || "Bank Account") : (cardMap[t.toCardId] || "Credit Card");
      return (
        '<div class="tx-row" data-tx-id="' + t.id + '">' +
        '<div class="tx-main">' +
        '<div class="tx-category">⇄ ' + u.escapeHtml(fromLabel) + " → " + u.escapeHtml(toLabel) + "</div>" +
        (t.note ? '<div class="tx-note">' + u.escapeHtml(t.note) + "</div>" : "") +
        "</div>" +
        '<div class="tx-amount transfer">' + u.formatCurrency(t.amount) + "</div>" +
        "</div>"
      );
    }
    var sign = t.type === "income" ? "+" : "−";
    var cls = t.type === "income" ? "income" : "expense";
    var meta = t.type === "expense" ? u.escapeHtml(t.category) + " · " + u.escapeHtml(t.mode) : u.escapeHtml(t.category);
    if (t.type === "expense" && t.expenseType === "Trip") meta = '<span class="trip-tag">✈ Trip</span> ' + meta;
    return (
      '<div class="tx-row" data-tx-id="' + t.id + '">' +
      '<div class="tx-main">' +
      '<div class="tx-category">' + meta + "</div>" +
      (t.note ? '<div class="tx-note">' + u.escapeHtml(t.note) + "</div>" : "") +
      "</div>" +
      '<div class="tx-amount ' + cls + '">' + sign + u.formatCurrency(t.amount) + "</div>" +
      "</div>"
    );
  }

  function csvField(v) {
    var s = v == null ? "" : String(v);
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buildCsv(txs, bankMap, cardMap) {
    var rows = [["Date", "Type", "Category", "Expense Type", "Mode of Payment", "Account / Card", "Amount", "Note"]];
    txs.forEach(function (t) {
      if (t.type === "transfer") {
        var fromLabel = t.from === "Bank Account" ? (bankMap[t.fromAccountId] || "Bank Account") : "Bank Refund";
        var toLabel = t.to === "Bank Account" ? (bankMap[t.toAccountId] || "Bank Account") : (cardMap[t.toCardId] || "Credit Card");
        rows.push([t.date, "Transfer", "", "", "", fromLabel + " -> " + toLabel, u.formatPlain(t.amount), t.note || ""]);
      } else if (t.type === "expense") {
        var linked = "";
        if (t.mode === "Credit Card") linked = cardMap[t.cardId] || "";
        else if (t.mode === "Debit Card" || t.mode === "UPI") linked = bankMap[t.bankAccountId] || "";
        rows.push([t.date, "Expense", t.category, t.expenseType || "Everyday", t.mode || "", linked, u.formatPlain(t.amount), t.note || ""]);
      } else {
        rows.push([t.date, "Income", t.category, "", "", "", u.formatPlain(t.amount), t.note || ""]);
      }
    });
    return rows.map(function (r) { return r.map(csvField).join(","); }).join("\r\n");
  }

  function exportToExcel() {
    Promise.all([
      App.db.getAllTransactions(),
      App.db.getAllBankAccounts(),
      App.db.getAllCreditCards(),
    ]).then(function (r) {
      var txs = r[0].slice().sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a.createdAt < b.createdAt ? -1 : 1;
      });
      var bankMap = {}, cardMap = {};
      r[1].forEach(function (a) { bankMap[a.id] = a.bankName; });
      r[2].forEach(function (c) { cardMap[c.id] = c.bankName; });

      var csv = buildCsv(txs, bankMap, cardMap);
      var blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "budgeit-export-" + u.todayISO() + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return {
    render: render,
  };
})();
