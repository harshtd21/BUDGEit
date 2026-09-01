var App = App || {};

App.forms = (function () {
  var u = App.utils;
  var cats = App.categories;
  var overlay = null;

  function closeOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  function openActionSheet() {
    closeOverlay();
    overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="action-sheet">' +
      '<button type="button" class="sheet-btn" data-action="income">Income</button>' +
      '<button type="button" class="sheet-btn" data-action="expense">Expense</button>' +
      '<button type="button" class="sheet-btn" data-action="transfer">Transfer</button>' +
      '<button type="button" class="sheet-btn sheet-cancel" data-action="cancel">Cancel</button>' +
      "</div>";
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        closeOverlay();
        return;
      }
      var action = e.target.getAttribute("data-action");
      if (action === "income") {
        closeOverlay();
        openTransactionForm("income", null);
      } else if (action === "expense") {
        closeOverlay();
        openTransactionForm("expense", null);
      } else if (action === "transfer") {
        closeOverlay();
        openTransferForm(null);
      } else if (action === "cancel") {
        closeOverlay();
      }
    });
  }

  // type: "income" | "expense"; existing: transaction object or null (edit mode)
  function openTransactionForm(type, existing) {
    closeOverlay();
    if (type === "income") {
      buildIncomeForm(existing);
      return;
    }
    var initialExpenseType = existing ? existing.expenseType || "Everyday" : "Everyday";
    Promise.all([cats.expenseCategoriesAsync(initialExpenseType), App.db.getAllCreditCards(), App.db.getAllBankAccounts()]).then(function (r) {
      buildExpenseForm(existing, initialExpenseType, r[0], r[1], r[2]);
    });
  }

  function buildIncomeForm(existing) {
    var isEdit = !!existing;
    var categoryList = cats.INCOME;
    var date = existing ? existing.date : u.todayISO();
    var amount = existing ? u.formatPlain(existing.amount) : "";
    var category = existing ? existing.category : categoryList[0];
    var note = existing ? existing.note : "";

    var categoryChips = categoryList
      .map(function (c) {
        return chipHtml(c, c, c === category, "data-category");
      })
      .join("");

    overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      formShell(
        (isEdit ? "Edit " : "Add ") + "Income",
        '<label class="field-label">Date</label>' +
          '<input type="date" class="field-input" id="f-date" value="' + date + '">' +
          '<label class="field-label">Amount</label>' +
          '<input type="number" inputmode="decimal" step="0.01" min="0" class="field-input" id="f-amount" placeholder="0.00" value="' + u.escapeHtml(amount) + '">' +
          '<label class="field-label">Category</label>' +
          '<div class="chip-row" id="f-category-row">' + categoryChips + "</div>" +
          '<label class="field-label">Note</label>' +
          '<input type="text" class="field-input" id="f-note" placeholder="Optional" value="' + u.escapeHtml(note) + '">' +
          (isEdit ? '<button type="button" class="delete-btn" data-action="delete">Delete Transaction</button>' : "")
      );
    document.body.appendChild(overlay);

    var selectedCategory = category;
    overlay.querySelector("#f-category-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-category]");
      if (!btn) return;
      selectedCategory = btn.getAttribute("data-category");
      selectChip(overlay, "#f-category-row", btn);
    });

    wireCommonActions(overlay, existing, function save() {
      var errorEl = overlay.querySelector("#f-error");
      var dateVal = overlay.querySelector("#f-date").value;
      var amountVal = parseFloat(overlay.querySelector("#f-amount").value);
      var noteVal = overlay.querySelector("#f-note").value.trim();

      if (!dateVal) {
        errorEl.textContent = "Please select a date.";
        return;
      }
      if (!amountVal || amountVal <= 0 || isNaN(amountVal)) {
        errorEl.textContent = "Please enter an amount greater than 0.";
        return;
      }

      var record = {
        id: isEdit ? existing.id : u.uuid(),
        type: "income",
        date: dateVal,
        amount: u.round2(amountVal),
        category: selectedCategory,
        note: noteVal,
        createdAt: isEdit ? existing.createdAt : new Date().toISOString(),
      };
      var op = isEdit ? App.db.updateTransaction(record) : App.db.addTransaction(record);
      op.then(function () {
        closeOverlay();
        App.app.refreshActiveTab();
      });
    });
  }

  var OTHERS_VALUE = "__others__";

  function buildExpenseForm(existing, expenseType, categoryList, cardList, bankList) {
    var isEdit = !!existing;
    var date = existing ? existing.date : u.todayISO();
    var amount = existing ? u.formatPlain(existing.amount) : "";
    var mode = existing ? existing.mode : defaultMode(cardList, bankList);
    var cardId = existing ? existing.cardId : null;
    var bankAccountId = existing ? existing.bankAccountId : null;
    var note = existing ? existing.note : "";

    var typeChips = ["Everyday", "Trip"].map(function (t) {
      return chipHtml(t, t, t === expenseType, "data-expense-type");
    }).join("");

    var modeChips = cats.MODES.map(function (m) {
      return chipHtml(m, m, m === mode, "data-mode");
    }).join("");

    overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      formShell(
        (isEdit ? "Edit " : "Add ") + "Expense",
        '<div class="chip-row" id="f-type-row">' + typeChips + "</div>" +
          '<label class="field-label">Date</label>' +
          '<input type="date" class="field-input" id="f-date" value="' + date + '">' +
          '<label class="field-label">Amount</label>' +
          '<input type="number" inputmode="decimal" step="0.01" min="0" class="field-input" id="f-amount" placeholder="0.00" value="' + u.escapeHtml(amount) + '">' +
          '<label class="field-label">Category</label>' +
          '<div id="f-category-container"></div>' +
          '<label class="field-label">Mode of Payment</label>' +
          '<div class="chip-row" id="f-mode-row">' + modeChips + "</div>" +
          '<div id="f-linked-row"></div>' +
          '<label class="field-label">Note</label>' +
          '<input type="text" class="field-input" id="f-note" placeholder="Optional" value="' + u.escapeHtml(note) + '">' +
          (isEdit ? '<button type="button" class="delete-btn" data-action="delete">Delete Transaction</button>' : "")
      );
    document.body.appendChild(overlay);

    var selectedExpenseType = expenseType;
    var selectedMode = mode;
    var selectedCardId = cardId;
    var selectedBankAccountId = bankAccountId;
    var othersMode = false;
    var customCategoryText = "";
    var selectedCategory = existing ? existing.category : categoryList[0];
    if (existing && categoryList.indexOf(existing.category) === -1) {
      othersMode = true;
      customCategoryText = existing.category;
    }

    function renderCategoryRow(list) {
      var container = overlay.querySelector("#f-category-container");
      var chipsHtml =
        list.map(function (c) { return chipHtml(c, c, !othersMode && c === selectedCategory, "data-category"); }).join("") +
        chipHtml("Others", OTHERS_VALUE, othersMode, "data-category");
      container.innerHTML =
        '<div class="chip-row" id="f-category-row">' + chipsHtml + "</div>" +
        (othersMode
          ? '<input type="text" class="field-input" id="f-custom-category" placeholder="Enter category name" value="' + u.escapeHtml(customCategoryText) + '" style="margin-top:8px;">'
          : "");

      container.querySelector("#f-category-row").addEventListener("click", function (e) {
        var btn = e.target.closest("[data-category]");
        if (!btn) return;
        var val = btn.getAttribute("data-category");
        if (val === OTHERS_VALUE) {
          othersMode = true;
        } else {
          othersMode = false;
          selectedCategory = val;
        }
        renderCategoryRow(list);
      });

      if (othersMode) {
        var input = container.querySelector("#f-custom-category");
        input.focus();
        input.addEventListener("input", function () {
          customCategoryText = input.value;
        });
      }
    }
    renderCategoryRow(categoryList);

    overlay.querySelector("#f-type-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-expense-type]");
      if (!btn) return;
      var newType = btn.getAttribute("data-expense-type");
      if (newType === selectedExpenseType) return;
      selectedExpenseType = newType;
      selectChip(overlay, "#f-type-row", btn);
      cats.expenseCategoriesAsync(selectedExpenseType).then(function (list) {
        othersMode = false;
        selectedCategory = list[0];
        renderCategoryRow(list);
      });
    });

    function renderLinkedRow() {
      var row = overlay.querySelector("#f-linked-row");
      if (selectedMode === "Credit Card") {
        row.innerHTML = cardList.length
          ? '<label class="field-label">Card</label><div class="chip-row" id="f-link-row">' +
            cardList.map(function (c) { return chipHtml(c.bankName, c.id, c.id === selectedCardId, "data-link-id"); }).join("") +
            "</div>"
          : '<p class="field-hint">No credit cards added yet — add one in the Accounts tab to track this card’s balance automatically.</p>';
      } else if (selectedMode === "Debit Card" || selectedMode === "UPI") {
        row.innerHTML = bankList.length
          ? '<label class="field-label">Bank Account</label><div class="chip-row" id="f-link-row">' +
            bankList.map(function (a) { return chipHtml(a.bankName, a.id, a.id === selectedBankAccountId, "data-link-id"); }).join("") +
            "</div>"
          : '<p class="field-hint">No bank accounts added yet — add one in the Accounts tab to track its balance automatically.</p>';
      } else {
        row.innerHTML = "";
      }
      var linkRow = row.querySelector("#f-link-row");
      if (linkRow) {
        linkRow.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-link-id]");
          if (!btn) return;
          var id = btn.getAttribute("data-link-id");
          if (selectedMode === "Credit Card") selectedCardId = id;
          else selectedBankAccountId = id;
          selectChip(overlay, "#f-link-row", btn);
        });
      }
    }
    renderLinkedRow();

    overlay.querySelector("#f-mode-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-mode]");
      if (!btn) return;
      selectedMode = btn.getAttribute("data-mode");
      selectedCardId = null;
      selectedBankAccountId = null;
      selectChip(overlay, "#f-mode-row", btn);
      renderLinkedRow();
    });

    wireCommonActions(overlay, existing, function save() {
      var errorEl = overlay.querySelector("#f-error");
      var dateVal = overlay.querySelector("#f-date").value;
      var amountVal = parseFloat(overlay.querySelector("#f-amount").value);
      var noteVal = overlay.querySelector("#f-note").value.trim();

      if (!dateVal) {
        errorEl.textContent = "Please select a date.";
        return;
      }
      if (!amountVal || amountVal <= 0 || isNaN(amountVal)) {
        errorEl.textContent = "Please enter an amount greater than 0.";
        return;
      }
      if (othersMode && !customCategoryText.trim()) {
        errorEl.textContent = "Please enter a category name.";
        return;
      }
      if (selectedMode === "Credit Card" && cardList.length && !selectedCardId) {
        errorEl.textContent = "Please select a card.";
        return;
      }
      if ((selectedMode === "Debit Card" || selectedMode === "UPI") && bankList.length && !selectedBankAccountId) {
        errorEl.textContent = "Please select a bank account.";
        return;
      }

      var categoryPromise = othersMode
        ? cats.resolveOrCreateCustomCategory(customCategoryText, selectedExpenseType)
        : Promise.resolve(selectedCategory);

      categoryPromise.then(function (finalCategory) {
        var record = {
          id: existing ? existing.id : u.uuid(),
          type: "expense",
          expenseType: selectedExpenseType,
          date: dateVal,
          amount: u.round2(amountVal),
          category: finalCategory,
          mode: selectedMode,
          cardId: selectedMode === "Credit Card" ? selectedCardId : null,
          bankAccountId: selectedMode === "Debit Card" || selectedMode === "UPI" ? selectedBankAccountId : null,
          note: noteVal,
          createdAt: existing ? existing.createdAt : new Date().toISOString(),
        };
        return existing ? App.db.updateTransaction(record) : App.db.addTransaction(record);
      }).then(function () {
        closeOverlay();
        App.app.refreshActiveTab();
      });
    });
  }

  function openTransferForm(existing) {
    closeOverlay();
    Promise.all([App.db.getAllBankAccounts(), App.db.getAllCreditCards()]).then(function (r) {
      buildTransferForm(existing, r[0], r[1]);
    });
  }

  function buildTransferForm(existing, bankList, cardList) {
    var isEdit = !!existing;
    var date = existing ? existing.date : u.todayISO();
    var amount = existing ? u.formatPlain(existing.amount) : "";
    var from = existing ? existing.from : (bankList.length ? "Bank Account" : "Bank Refund");
    var to = existing ? existing.to : (bankList.length ? "Bank Account" : "Credit Card");
    var fromAccountId = existing ? existing.fromAccountId : null;
    var toAccountId = existing ? existing.toAccountId : null;
    var toCardId = existing ? existing.toCardId : null;
    var note = existing ? existing.note : "";

    var fromChips = ["Bank Account", "Bank Refund"].map(function (f) {
      var disabled = f === "Bank Account" && !bankList.length;
      return chipHtml(f, f, f === from, "data-from", disabled);
    }).join("");

    var toChips = ["Bank Account", "Credit Card"].map(function (t) {
      var disabled = (t === "Bank Account" && !bankList.length) || (t === "Credit Card" && !cardList.length);
      return chipHtml(t, t, t === to, "data-to", disabled);
    }).join("");

    overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      formShell(
        (isEdit ? "Edit " : "Add ") + "Transfer",
        '<label class="field-label">Date</label>' +
          '<input type="date" class="field-input" id="f-date" value="' + date + '">' +
          '<label class="field-label">Amount</label>' +
          '<input type="number" inputmode="decimal" step="0.01" min="0" class="field-input" id="f-amount" placeholder="0.00" value="' + u.escapeHtml(amount) + '">' +
          '<label class="field-label">From</label>' +
          '<div class="chip-row" id="f-from-row">' + fromChips + "</div>" +
          '<div id="f-from-link-row"></div>' +
          '<label class="field-label">To</label>' +
          '<div class="chip-row" id="f-to-row">' + toChips + "</div>" +
          '<div id="f-to-link-row"></div>' +
          '<label class="field-label">Note</label>' +
          '<input type="text" class="field-input" id="f-note" placeholder="Optional" value="' + u.escapeHtml(note) + '">' +
          (isEdit ? '<button type="button" class="delete-btn" data-action="delete">Delete Transfer</button>' : "")
      );
    document.body.appendChild(overlay);

    var selectedFrom = from;
    var selectedTo = to;
    var selectedFromAccountId = fromAccountId;
    var selectedToAccountId = toAccountId;
    var selectedToCardId = toCardId;

    function renderFromLink() {
      var row = overlay.querySelector("#f-from-link-row");
      if (selectedFrom === "Bank Account") {
        row.innerHTML =
          '<div class="chip-row" id="f-from-link">' +
          bankList.map(function (a) { return chipHtml(a.bankName, a.id, a.id === selectedFromAccountId, "data-id"); }).join("") +
          "</div>";
        row.querySelector("#f-from-link").addEventListener("click", function (e) {
          var btn = e.target.closest("[data-id]");
          if (!btn) return;
          selectedFromAccountId = btn.getAttribute("data-id");
          selectChip(overlay, "#f-from-link", btn);
        });
      } else {
        row.innerHTML = "";
        selectedFromAccountId = null;
      }
    }

    function renderToLink() {
      var row = overlay.querySelector("#f-to-link-row");
      if (selectedTo === "Bank Account") {
        row.innerHTML =
          '<div class="chip-row" id="f-to-link">' +
          bankList.map(function (a) { return chipHtml(a.bankName, a.id, a.id === selectedToAccountId, "data-id"); }).join("") +
          "</div>";
        row.querySelector("#f-to-link").addEventListener("click", function (e) {
          var btn = e.target.closest("[data-id]");
          if (!btn) return;
          selectedToAccountId = btn.getAttribute("data-id");
          selectChip(overlay, "#f-to-link", btn);
        });
      } else if (selectedTo === "Credit Card") {
        row.innerHTML =
          '<div class="chip-row" id="f-to-link">' +
          cardList.map(function (c) { return chipHtml(c.bankName, c.id, c.id === selectedToCardId, "data-id"); }).join("") +
          "</div>";
        row.querySelector("#f-to-link").addEventListener("click", function (e) {
          var btn = e.target.closest("[data-id]");
          if (!btn) return;
          selectedToCardId = btn.getAttribute("data-id");
          selectChip(overlay, "#f-to-link", btn);
        });
      } else {
        row.innerHTML = "";
      }
      if (selectedTo !== "Bank Account") selectedToAccountId = null;
      if (selectedTo !== "Credit Card") selectedToCardId = null;
    }

    renderFromLink();
    renderToLink();

    overlay.querySelector("#f-from-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-from]");
      if (!btn || btn.classList.contains("chip-disabled")) return;
      selectedFrom = btn.getAttribute("data-from");
      selectChip(overlay, "#f-from-row", btn);
      renderFromLink();
    });

    overlay.querySelector("#f-to-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-to]");
      if (!btn || btn.classList.contains("chip-disabled")) return;
      selectedTo = btn.getAttribute("data-to");
      selectChip(overlay, "#f-to-row", btn);
      renderToLink();
    });

    wireCommonActions(overlay, existing, function save() {
      var errorEl = overlay.querySelector("#f-error");
      var dateVal = overlay.querySelector("#f-date").value;
      var amountVal = parseFloat(overlay.querySelector("#f-amount").value);
      var noteVal = overlay.querySelector("#f-note").value.trim();

      if (!dateVal) {
        errorEl.textContent = "Please select a date.";
        return;
      }
      if (!amountVal || amountVal <= 0 || isNaN(amountVal)) {
        errorEl.textContent = "Please enter an amount greater than 0.";
        return;
      }
      if (selectedFrom === "Bank Account" && !selectedFromAccountId) {
        errorEl.textContent = "Please select a source bank account.";
        return;
      }
      if (selectedTo === "Bank Account" && !selectedToAccountId) {
        errorEl.textContent = "Please select a destination bank account.";
        return;
      }
      if (selectedTo === "Credit Card" && !selectedToCardId) {
        errorEl.textContent = "Please select a destination credit card.";
        return;
      }
      if (selectedFrom === "Bank Account" && selectedTo === "Bank Account" && selectedFromAccountId === selectedToAccountId) {
        errorEl.textContent = "From and To accounts must be different.";
        return;
      }

      var record = {
        id: existing ? existing.id : u.uuid(),
        type: "transfer",
        date: dateVal,
        amount: u.round2(amountVal),
        from: selectedFrom,
        fromAccountId: selectedFrom === "Bank Account" ? selectedFromAccountId : null,
        to: selectedTo,
        toAccountId: selectedTo === "Bank Account" ? selectedToAccountId : null,
        toCardId: selectedTo === "Credit Card" ? selectedToCardId : null,
        note: noteVal,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
      };
      var op = existing ? App.db.updateTransaction(record) : App.db.addTransaction(record);
      op.then(function () {
        closeOverlay();
        App.app.refreshActiveTab();
      });
    });
  }

  // ---------- shared helpers ----------

  function formShell(title, bodyHtml) {
    return (
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>" + title + "</h2>" +
      '<button type="button" class="form-save" data-action="save">Save</button>' +
      "</div>" +
      '<div class="form-body">' +
      bodyHtml +
      '<p class="field-error" id="f-error"></p>' +
      "</div>" +
      "</div>"
    );
  }

  function defaultMode(cardList, bankList) {
    if (bankList.length) return "UPI";
    if (cardList.length) return "Credit Card";
    return "Cash";
  }

  function chipHtml(label, value, selected, dataAttr, disabled) {
    return (
      '<button type="button" class="chip' +
      (selected ? " chip-selected" : "") +
      (disabled ? " chip-disabled" : "") +
      '" ' + dataAttr + '="' + u.escapeHtml(value) + '"' +
      (disabled ? ' title="No options available yet"' : "") +
      ">" +
      u.escapeHtml(label) +
      "</button>"
    );
  }

  function selectChip(scope, rowSelector, selectedBtn) {
    scope.querySelectorAll(rowSelector + " .chip").forEach(function (c) {
      c.classList.toggle("chip-selected", c === selectedBtn);
    });
  }

  function wireCommonActions(scopeOverlay, existing, saveFn) {
    scopeOverlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (action === "close") {
        closeOverlay();
      } else if (action === "save") {
        saveFn();
      } else if (action === "delete") {
        if (confirm("Delete this transaction? This cannot be undone.")) {
          App.db.deleteTransaction(existing.id).then(function () {
            closeOverlay();
            App.app.refreshActiveTab();
          });
        }
      }
    });
  }

  return {
    openActionSheet: openActionSheet,
    openTransactionForm: openTransactionForm,
    openTransferForm: openTransferForm,
    closeOverlay: closeOverlay,
  };
})();
