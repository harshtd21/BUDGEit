var App = App || {};

App.loans = (function () {
  var u = App.utils;
  var cats = App.categories;

  function render(container) {
    Promise.all([App.db.getAllShortTermEmis(), App.db.getAllLoans(), App.db.getAllTransactions()]).then(function (r) {
      var emis = r[0], loanList = r[1], txs = r[2];

      container.innerHTML =
        '<div class="section-header">Short-term EMIs</div>' +
        '<div class="item-list">' +
        (emis.length ? emis.map(function (e) { return emiRowHtml(e, txs); }).join("") : '<div class="empty-list">No short-term EMIs yet.</div>') +
        "</div>" +
        '<button type="button" class="secondary-btn" id="add-emi-btn">+ Add Short-term EMI</button>' +
        '<div class="section-header" style="margin-top:28px;">Loans</div>' +
        '<div class="item-list">' +
        (loanList.length ? loanList.map(function (l) { return loanRowHtml(l, txs); }).join("") : '<div class="empty-list">No loans yet.</div>') +
        "</div>" +
        '<button type="button" class="secondary-btn" id="add-loan-btn">+ Add Loan</button>';

      container.querySelectorAll("[data-emi-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var emi = emis.find(function (e) { return e.id === row.getAttribute("data-emi-id"); });
          if (emi) openEmiForm(emi, container);
        });
      });
      container.querySelectorAll("[data-loan-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var loan = loanList.find(function (l) { return l.id === row.getAttribute("data-loan-id"); });
          if (loan) openLoanForm(loan, container);
        });
      });
      container.querySelector("#add-emi-btn").addEventListener("click", function () {
        openEmiForm(null, container);
      });
      container.querySelector("#add-loan-btn").addEventListener("click", function () {
        openLoanForm(null, container);
      });
    });
  }

  function emiRowHtml(e, txs) {
    var s = App.derived.emiState(e, txs);
    return (
      '<div class="item-row" data-emi-id="' + e.id + '">' +
      '<div class="item-main">' +
      '<div class="item-title">' + u.escapeHtml(e.name) + "</div>" +
      '<div class="item-sub">' + u.formatCurrency(e.emiAmount) + "/mo · " + s.currentRemainingMonths + " months left</div>" +
      "</div>" +
      '<div class="item-value">' + u.formatCurrency(s.currentPrincipal) + "</div>" +
      "</div>"
    );
  }

  function loanRowHtml(l, txs) {
    var s = App.derived.loanState(l, txs);
    return (
      '<div class="item-row" data-loan-id="' + l.id + '">' +
      '<div class="item-main">' +
      '<div class="item-title">' + u.escapeHtml(l.name) + ' <span class="badge">' + u.escapeHtml(l.category) + "</span></div>" +
      '<div class="item-sub">' + u.formatCurrency(s.currentEMI) + "/mo · " + l.interestRate + "% · " + s.currentTenureMonths + " months left</div>" +
      "</div>" +
      '<div class="item-value">' + u.formatCurrency(s.currentPrincipal) + "</div>" +
      "</div>"
    );
  }

  function openEmiForm(existing, container) {
    var isEdit = !!existing;
    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>" + (isEdit ? "Edit Short-term EMI" : "Add Short-term EMI") + "</h2>" +
      '<button type="button" class="form-save" data-action="save">Save</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<label class="field-label">Name</label>' +
      '<input type="text" class="field-input" id="e-name" placeholder="e.g. iPhone EMI" value="' + (existing ? u.escapeHtml(existing.name) : "") + '">' +
      '<p class="field-hint">This name becomes an Expense category — log repayments under it to track this EMI automatically.</p>' +
      '<label class="field-label">Outstanding Principal</label>' +
      '<input type="number" inputmode="decimal" step="0.01" class="field-input" id="e-principal" placeholder="0.00" value="' + (existing ? u.formatPlain(existing.startingPrincipal) : "") + '">' +
      '<label class="field-label">EMI Amount</label>' +
      '<input type="number" inputmode="decimal" step="0.01" class="field-input" id="e-amount" placeholder="0.00" value="' + (existing ? u.formatPlain(existing.emiAmount) : "") + '">' +
      '<label class="field-label">Remaining Months</label>' +
      '<input type="number" inputmode="numeric" step="1" min="0" class="field-input" id="e-months" value="' + (existing ? existing.startingRemainingMonths : "") + '">' +
      (isEdit
        ? '<p class="field-hint">Editing these corrects the starting point only — it does not remove the effect of repayments already logged.</p>'
        : "") +
      (isEdit ? '<button type="button" class="delete-btn" data-action="delete">Delete EMI</button>' : "") +
      '<p class="field-error" id="e-error"></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (e.target === overlay || action === "close") {
        overlay.remove();
      } else if (action === "save") {
        save();
      } else if (action === "delete") {
        if (confirm("Delete this EMI? This cannot be undone. Past transactions keep their category.")) {
          App.db.deleteShortTermEmi(existing.id).then(function () {
            overlay.remove();
            render(container);
          });
        }
      }
    });

    function save() {
      var errorEl = overlay.querySelector("#e-error");
      var name = overlay.querySelector("#e-name").value.trim();
      var principal = parseFloat(overlay.querySelector("#e-principal").value);
      var emiAmount = parseFloat(overlay.querySelector("#e-amount").value);
      var months = parseInt(overlay.querySelector("#e-months").value, 10);

      if (!name) {
        errorEl.textContent = "Please enter a name.";
        return;
      }
      if (isNaN(principal) || principal < 0) {
        errorEl.textContent = "Please enter a valid outstanding principal.";
        return;
      }
      if (isNaN(emiAmount) || emiAmount <= 0) {
        errorEl.textContent = "Please enter a valid EMI amount.";
        return;
      }
      if (isNaN(months) || months < 0) {
        errorEl.textContent = "Please enter valid remaining months.";
        return;
      }

      cats.isNameAvailable(name, isEdit ? existing.id : null).then(function (available) {
        if (!available) {
          errorEl.textContent = "That name is already used by another category, EMI, or loan. Choose a unique name.";
          return;
        }
        var oldName = isEdit ? existing.name : null;
        var record = {
          id: isEdit ? existing.id : u.uuid(),
          name: name,
          startingPrincipal: u.round2(principal),
          emiAmount: u.round2(emiAmount),
          startingRemainingMonths: months,
          createdAt: isEdit ? existing.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        var op = isEdit ? App.db.updateShortTermEmi(record) : App.db.addShortTermEmi(record);
        op.then(function () {
          if (isEdit && oldName && oldName !== name) return cascadeRenameCategory(oldName, name);
        }).then(function () {
          overlay.remove();
          render(container);
        });
      });
    }
  }

  function openLoanForm(existing, container) {
    var isEdit = !!existing;
    var category = existing ? existing.category : cats.LOAN_TYPES[0];

    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>" + (isEdit ? "Edit Loan" : "Add Loan") + "</h2>" +
      '<button type="button" class="form-save" data-action="save">Save</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<label class="field-label">Name</label>' +
      '<input type="text" class="field-input" id="l-name" placeholder="e.g. Home Loan" value="' + (existing ? u.escapeHtml(existing.name) : "") + '">' +
      '<p class="field-hint">This name becomes an Expense category — log repayments under it to track this loan automatically.</p>' +
      '<label class="field-label">Category</label>' +
      '<div class="chip-row" id="l-category-row">' +
      cats.LOAN_TYPES.map(function (t) {
        return '<button type="button" class="chip' + (t === category ? " chip-selected" : "") + '" data-cat="' + t + '">' + t + "</button>";
      }).join("") +
      "</div>" +
      '<label class="field-label">Outstanding Principal</label>' +
      '<input type="number" inputmode="decimal" step="0.01" class="field-input" id="l-principal" placeholder="0.00" value="' + (existing ? u.formatPlain(existing.startingPrincipal) : "") + '">' +
      '<label class="field-label">Interest Rate (% per year)</label>' +
      '<input type="number" inputmode="decimal" step="0.01" min="0" class="field-input" id="l-rate" value="' + (existing ? existing.interestRate : "") + '">' +
      '<label class="field-label">Outstanding Tenure (months)</label>' +
      '<input type="number" inputmode="numeric" step="1" min="0" class="field-input" id="l-tenure" value="' + (existing ? existing.startingTenureMonths : "") + '">' +
      '<label class="field-label">Current EMI (calculated)</label>' +
      '<div class="computed-value" id="l-emi-preview">' + (existing ? u.formatCurrency(App.derived.loanState(existing, []).currentEMI) : u.formatCurrency(0)) + "</div>" +
      (isEdit
        ? '<p class="field-hint">Editing these corrects the starting point only — it does not remove the effect of repayments already logged.</p>'
        : "") +
      (isEdit ? '<button type="button" class="delete-btn" data-action="delete">Delete Loan</button>' : "") +
      '<p class="field-error" id="l-error"></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    var selectedCategory = category;
    overlay.querySelector("#l-category-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-cat]");
      if (!btn) return;
      selectedCategory = btn.getAttribute("data-cat");
      overlay.querySelectorAll("#l-category-row .chip").forEach(function (c) {
        c.classList.toggle("chip-selected", c === btn);
      });
    });

    function updateEmiPreview() {
      var principal = parseFloat(overlay.querySelector("#l-principal").value) || 0;
      var rate = parseFloat(overlay.querySelector("#l-rate").value) || 0;
      var tenure = parseInt(overlay.querySelector("#l-tenure").value, 10) || 0;
      overlay.querySelector("#l-emi-preview").textContent = u.formatCurrency(u.calculateEMI(principal, rate, tenure));
    }
    ["#l-principal", "#l-rate", "#l-tenure"].forEach(function (sel) {
      overlay.querySelector(sel).addEventListener("input", updateEmiPreview);
    });

    overlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (e.target === overlay || action === "close") {
        overlay.remove();
      } else if (action === "save") {
        save();
      } else if (action === "delete") {
        if (confirm("Delete this loan? This cannot be undone. Past transactions keep their category.")) {
          App.db.deleteLoan(existing.id).then(function () {
            overlay.remove();
            render(container);
          });
        }
      }
    });

    function save() {
      var errorEl = overlay.querySelector("#l-error");
      var name = overlay.querySelector("#l-name").value.trim();
      var principal = parseFloat(overlay.querySelector("#l-principal").value);
      var rate = parseFloat(overlay.querySelector("#l-rate").value);
      var tenure = parseInt(overlay.querySelector("#l-tenure").value, 10);

      if (!name) {
        errorEl.textContent = "Please enter a name.";
        return;
      }
      if (isNaN(principal) || principal < 0) {
        errorEl.textContent = "Please enter a valid outstanding principal.";
        return;
      }
      if (isNaN(rate) || rate < 0) {
        errorEl.textContent = "Please enter a valid interest rate.";
        return;
      }
      if (isNaN(tenure) || tenure <= 0) {
        errorEl.textContent = "Please enter a valid outstanding tenure.";
        return;
      }

      cats.isNameAvailable(name, isEdit ? existing.id : null).then(function (available) {
        if (!available) {
          errorEl.textContent = "That name is already used by another category, EMI, or loan. Choose a unique name.";
          return;
        }
        var oldName = isEdit ? existing.name : null;
        var record = {
          id: isEdit ? existing.id : u.uuid(),
          name: name,
          category: selectedCategory,
          startingPrincipal: u.round2(principal),
          interestRate: rate,
          startingTenureMonths: tenure,
          createdAt: isEdit ? existing.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        var op = isEdit ? App.db.updateLoan(record) : App.db.addLoan(record);
        op.then(function () {
          if (isEdit && oldName && oldName !== name) return cascadeRenameCategory(oldName, name);
        }).then(function () {
          overlay.remove();
          render(container);
        });
      });
    }
  }

  function cascadeRenameCategory(oldName, newName) {
    var renameTransactions = App.db.getAllTransactions().then(function (all) {
      var toUpdate = all.filter(function (t) { return t.type === "expense" && t.category === oldName; });
      return Promise.all(
        toUpdate.map(function (t) {
          t.category = newName;
          return App.db.updateTransaction(t);
        })
      );
    });
    var renameBudget = App.db.getBudget(oldName).then(function (b) {
      if (!b) return;
      return App.db.deleteBudget(oldName).then(function () {
        return App.db.setBudget(newName, b.amount);
      });
    });
    return Promise.all([renameTransactions, renameBudget]);
  }

  return { render: render };
})();
