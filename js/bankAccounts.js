var App = App || {};

App.bankAccounts = (function () {
  var u = App.utils;
  var cats = App.categories;

  function render(container) {
    Promise.all([App.db.getAllBankAccounts(), App.db.getAllTransactions()]).then(function (r) {
      var accounts = r[0], txs = r[1];

      container.innerHTML =
        '<div class="section-header">Bank Accounts</div>' +
        '<div class="item-list">' +
        (accounts.length
          ? accounts.map(function (a) { return rowHtml(a, txs); }).join("")
          : '<div class="empty-list">No bank accounts yet.</div>') +
        "</div>" +
        '<button type="button" class="secondary-btn" id="add-bank-account-btn">+ Add Bank Account</button>';

      container.querySelectorAll("[data-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var acc = accounts.find(function (a) { return a.id === row.getAttribute("data-id"); });
          if (acc) openForm(acc, container, txs);
        });
      });
      container.querySelector("#add-bank-account-btn").addEventListener("click", function () {
        openForm(null, container, txs);
      });
    });
  }

  function rowHtml(a, txs) {
    var balance = App.derived.bankAccountBalance(a, txs);
    return (
      '<div class="item-row" data-id="' + a.id + '">' +
      '<div class="item-main">' +
      '<div class="item-title">' + u.escapeHtml(a.bankName) + ' <span class="badge ' + (a.accountType === "Savings" ? "badge-blue" : "badge-violet") + '">' + u.escapeHtml(a.accountType) + "</span></div>" +
      '<div class="item-sub">' + u.escapeHtml(u.maskAccountNumber(a.accountNumber)) + "</div>" +
      "</div>" +
      '<div class="item-value">' + u.formatCurrency(balance) + "</div>" +
      "</div>"
    );
  }

  function openForm(existing, container, txs) {
    var isEdit = !!existing;
    var accountType = existing ? existing.accountType : cats.ACCOUNT_TYPES[0];

    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>" + (isEdit ? "Edit Bank Account" : "Add Bank Account") + "</h2>" +
      '<button type="button" class="form-save" data-action="save">Save</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<label class="field-label">Bank Name</label>' +
      '<input type="text" class="field-input" id="ba-bank" value="' + (existing ? u.escapeHtml(existing.bankName) : "") + '">' +
      '<label class="field-label">Account Number</label>' +
      '<input type="text" inputmode="numeric" class="field-input" id="ba-number" value="' + (existing ? u.escapeHtml(existing.accountNumber) : "") + '">' +
      '<label class="field-label">Account Type</label>' +
      '<div class="chip-row" id="ba-type-row">' +
      cats.ACCOUNT_TYPES.map(function (t) {
        return '<button type="button" class="chip' + (t === accountType ? " chip-selected" : "") + '" data-type="' + t + '">' + t + "</button>";
      }).join("") +
      "</div>" +
      '<label class="field-label">' + (isEdit ? "Starting Balance" : "Current Balance") + "</label>" +
      '<input type="number" inputmode="decimal" step="0.01" class="field-input" id="ba-balance" placeholder="0.00" value="' + (existing ? u.formatPlain(existing.startingBalance) : "") + '">' +
      (isEdit
        ? '<p class="field-hint">Editing this corrects the starting point only — it does not remove the effect of transactions already linked to this account.</p>'
        : "") +
      (isEdit ? '<button type="button" class="delete-btn" data-action="delete">Delete Bank Account</button>' : "") +
      '<p class="field-error" id="ba-error"></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    var selectedType = accountType;
    overlay.querySelector("#ba-type-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-type]");
      if (!btn) return;
      selectedType = btn.getAttribute("data-type");
      overlay.querySelectorAll("#ba-type-row .chip").forEach(function (c) {
        c.classList.toggle("chip-selected", c === btn);
      });
    });

    overlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (e.target === overlay || action === "close") {
        overlay.remove();
      } else if (action === "save") {
        save();
      } else if (action === "delete") {
        if (App.derived.hasLinkedTransactions("bankAccount", existing.id, txs)) {
          alert("This account has linked transactions and can't be deleted.");
          return;
        }
        if (confirm("Delete this bank account? This cannot be undone.")) {
          App.db.deleteBankAccount(existing.id).then(function () {
            overlay.remove();
            render(container);
          });
        }
      }
    });

    function save() {
      var errorEl = overlay.querySelector("#ba-error");
      var bankName = overlay.querySelector("#ba-bank").value.trim();
      var accountNumber = overlay.querySelector("#ba-number").value.trim();
      var balance = parseFloat(overlay.querySelector("#ba-balance").value);

      if (!bankName) {
        errorEl.textContent = "Please enter a bank name.";
        return;
      }
      if (!accountNumber) {
        errorEl.textContent = "Please enter an account number.";
        return;
      }
      if (isNaN(balance)) {
        errorEl.textContent = "Please enter a valid balance.";
        return;
      }

      var record = {
        id: isEdit ? existing.id : u.uuid(),
        bankName: bankName,
        accountNumber: accountNumber,
        accountType: selectedType,
        startingBalance: u.round2(balance),
        createdAt: isEdit ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      var op = isEdit ? App.db.updateBankAccount(record) : App.db.addBankAccount(record);
      op.then(function () {
        overlay.remove();
        render(container);
      });
    }
  }

  return { render: render, openForm: openForm };
})();
