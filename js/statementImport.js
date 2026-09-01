var App = App || {};

App.statementImport = (function () {
  var u = App.utils;
  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  function monthIndex(name) {
    return MONTHS.indexOf(name.toLowerCase().slice(0, 3));
  }

  function normalizeYear(y) {
    y = parseInt(y, 10);
    if (y < 100) y += 2000;
    return y;
  }

  function parseDateToken(line) {
    var m, d;
    m = line.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (m) {
      d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      if (!isNaN(d)) return { raw: m[0], iso: u.dateToISO(d) };
    }
    m = line.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
    if (m) {
      var day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = normalizeYear(m[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        d = new Date(year, month - 1, day);
        if (!isNaN(d)) return { raw: m[0], iso: u.dateToISO(d) };
      }
    }
    m = line.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s*'?(\d{2,4})\b/);
    if (m) {
      var mi = monthIndex(m[2]);
      if (mi >= 0) {
        d = new Date(normalizeYear(m[3]), mi, parseInt(m[1], 10));
        if (!isNaN(d)) return { raw: m[0], iso: u.dateToISO(d) };
      }
    }
    m = line.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/);
    if (m) {
      var mi2 = monthIndex(m[1]);
      if (mi2 >= 0) {
        d = new Date(normalizeYear(m[3]), mi2, parseInt(m[2], 10));
        if (!isNaN(d)) return { raw: m[0], iso: u.dateToISO(d) };
      }
    }
    return null;
  }

  function parseAmountToken(lineRemainder) {
    var matches = lineRemainder.match(/\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g);
    if (!matches || !matches.length) return null;
    var num = parseFloat(matches[matches.length - 1].replace(/,/g, ""));
    if (isNaN(num) || num <= 0) return null;
    return num;
  }

  // Best-effort line-based parser: finds a date and an amount per line, skips
  // lines tagged Cr (credits/refunds/payments) and anything outside the given
  // statement period. Not a real statement-format parser — the caller shows
  // a review checklist before anything is actually imported.
  function parseStatementText(text, startDate, endDate) {
    var lines = text.split(/\r?\n/);
    var total = 0;
    var results = [];
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      total++;
      var dateToken = parseDateToken(trimmed);
      if (!dateToken) return;
      if (dateToken.iso < startDate || dateToken.iso > endDate) return;
      if (/\bcr\b/i.test(trimmed)) return;
      var remainder = trimmed.replace(dateToken.raw, "");
      var amount = parseAmountToken(remainder);
      if (amount == null) return;
      results.push({
        date: dateToken.iso,
        amount: u.round2(amount),
        rawLine: trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed,
        included: true,
      });
    });
    return { rows: results, totalLines: total };
  }

  function openImportFlow() {
    App.db.getAllCreditCards().then(function (cards) {
      if (!cards.length) {
        alert("Add a Credit Card first — a statement import needs a card to assign the transactions to.");
        return;
      }
      renderSetupStep(cards);
    });
  }

  function renderSetupStep(cards) {
    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    var selectedCardId = cards[0].id;

    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>Import Statement</h2>" +
      '<button type="button" class="form-save" data-action="parse">Parse</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<label class="field-label">Credit Card</label>' +
      '<div class="chip-row" id="si-card-row">' +
      cards.map(function (c, idx) {
        return '<button type="button" class="chip' + (idx === 0 ? " chip-selected" : "") + '" data-card-id="' + c.id + '">' + u.escapeHtml(c.bankName) + "</button>";
      }).join("") +
      "</div>" +
      '<label class="field-label">Statement Start Date</label>' +
      '<input type="date" class="field-input" id="si-start">' +
      '<label class="field-label">Statement End Date</label>' +
      '<input type="date" class="field-input" id="si-end" value="' + u.todayISO() + '">' +
      '<label class="field-label">Paste Statement Text</label>' +
      '<textarea class="field-input" id="si-text" rows="10" placeholder="Paste the transaction lines copied from your statement here, one per line..." style="resize:vertical;"></textarea>' +
      '<p class="field-hint">Each line should contain a date and an amount. Lines marked Cr (credits/refunds/payments) are skipped automatically — everything else is shown for you to review before anything is saved.</p>' +
      '<p class="field-error" id="si-error"></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    overlay.querySelector("#si-card-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-card-id]");
      if (!btn) return;
      selectedCardId = btn.getAttribute("data-card-id");
      overlay.querySelectorAll("#si-card-row .chip").forEach(function (c) {
        c.classList.toggle("chip-selected", c === btn);
      });
    });

    overlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (e.target === overlay || action === "close") {
        overlay.remove();
      } else if (action === "parse") {
        var errorEl = overlay.querySelector("#si-error");
        var startDate = overlay.querySelector("#si-start").value;
        var endDate = overlay.querySelector("#si-end").value;
        var text = overlay.querySelector("#si-text").value;

        if (!startDate || !endDate) {
          errorEl.textContent = "Please enter both a start and end date.";
          return;
        }
        if (startDate > endDate) {
          errorEl.textContent = "Start date must be before end date.";
          return;
        }
        if (!text.trim()) {
          errorEl.textContent = "Please paste your statement text.";
          return;
        }

        var parsed = parseStatementText(text, startDate, endDate);
        if (!parsed.rows.length) {
          errorEl.textContent = "Couldn't find any transactions in that text within the given date range.";
          return;
        }
        overlay.remove();
        renderReviewStep(selectedCardId, cards, parsed);
      }
    });
  }

  function renderReviewStep(cardId, cards, parsed) {
    var card = cards.find(function (c) { return c.id === cardId; });
    var rows = parsed.rows;

    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>Review</h2>" +
      '<button type="button" class="form-save" data-action="import">Import</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<p class="field-hint">Found ' + rows.length + " of " + parsed.totalLines + " lines as candidate transactions for " + u.escapeHtml(card.bankName) + '. Uncheck or edit anything that looks wrong before importing.</p>' +
      '<div class="item-list" id="si-review-list">' +
      rows.map(function (row, idx) { return reviewRowHtml(row, idx); }).join("") +
      "</div>" +
      '<p class="field-error" id="si-review-error"></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    rows.forEach(function (row, idx) {
      var rowEl = overlay.querySelector('[data-row-idx="' + idx + '"]');
      rowEl.querySelector(".si-include").addEventListener("change", function (e) {
        row.included = e.target.checked;
      });
      rowEl.querySelector(".si-date").addEventListener("input", function (e) {
        row.date = e.target.value;
      });
      rowEl.querySelector(".si-amount").addEventListener("input", function (e) {
        row.amount = parseFloat(e.target.value);
      });
    });

    overlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (e.target === overlay || action === "close") {
        overlay.remove();
      } else if (action === "import") {
        var errorEl = overlay.querySelector("#si-review-error");
        var toImport = rows.filter(function (r) { return r.included; });
        if (!toImport.length) {
          errorEl.textContent = "Select at least one transaction to import.";
          return;
        }
        var invalid = toImport.some(function (r) { return !r.date || !r.amount || isNaN(r.amount) || r.amount <= 0; });
        if (invalid) {
          errorEl.textContent = "One or more selected rows has an invalid date or amount.";
          return;
        }
        Promise.all(
          toImport.map(function (r) {
            return App.db.addTransaction({
              id: u.uuid(),
              type: "expense",
              expenseType: "Everyday",
              date: r.date,
              amount: u.round2(r.amount),
              category: "Others",
              mode: "Credit Card",
              cardId: cardId,
              bankAccountId: null,
              note: r.rawLine,
              createdAt: new Date().toISOString(),
            });
          })
        ).then(function () {
          overlay.remove();
          App.app.refreshActiveTab();
        });
      }
    });
  }

  function reviewRowHtml(row, idx) {
    return (
      '<div class="item-row import-row" data-row-idx="' + idx + '">' +
      '<input type="checkbox" class="si-include" checked>' +
      '<div class="import-row-fields">' +
      '<div class="import-row-line">' + u.escapeHtml(row.rawLine) + "</div>" +
      '<div class="import-row-inputs">' +
      '<input type="date" class="field-input si-date" value="' + row.date + '">' +
      '<input type="number" step="0.01" class="field-input si-amount" value="' + u.formatPlain(row.amount) + '">' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  return {
    openImportFlow: openImportFlow,
    parseStatementText: parseStatementText,
  };
})();
