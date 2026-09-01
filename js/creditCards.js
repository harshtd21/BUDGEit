var App = App || {};

App.creditCards = (function () {
  var u = App.utils;

  function render(container) {
    Promise.all([App.db.getAllCreditCards(), App.db.getAllTransactions()]).then(function (r) {
      var cards = r[0], txs = r[1];

      container.innerHTML =
        '<div class="section-header">Credit Cards</div>' +
        '<div class="item-list">' +
        (cards.length ? cards.map(function (c) { return rowHtml(c, txs); }).join("") : '<div class="empty-list">No credit cards yet.</div>') +
        "</div>" +
        '<button type="button" class="secondary-btn" id="add-card-btn">+ Add Credit Card</button>';

      container.querySelectorAll("[data-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var card = cards.find(function (c) { return c.id === row.getAttribute("data-id"); });
          if (card) openForm(card, container, txs);
        });
      });
      container.querySelector("#add-card-btn").addEventListener("click", function () {
        openForm(null, container, txs);
      });
    });
  }

  function rowHtml(c, txs) {
    var s = App.derived.cardState(c, txs);
    return (
      '<div class="item-row" data-id="' + c.id + '">' +
      '<div class="item-main">' +
      '<div class="item-title">' + u.escapeHtml(c.bankName) + "</div>" +
      (c.statementStartDate && c.statementEndDate
        ? '<div class="item-sub">' + c.statementStartDate + " to " + c.statementEndDate + "</div>"
        : "") +
      "</div>" +
      '<div class="item-value">' + u.formatCurrency(s.amountPayable) + "</div>" +
      "</div>"
    );
  }

  function openForm(existing, container, txs) {
    var isEdit = !!existing;
    var startDate = existing && existing.statementStartDate ? existing.statementStartDate : u.startOfMonth(u.todayISO());
    var endDate = existing && existing.statementEndDate ? existing.statementEndDate : u.todayISO();
    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>" + (isEdit ? "Edit Credit Card" : "Add Credit Card") + "</h2>" +
      '<button type="button" class="form-save" data-action="save">Save</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<label class="field-label">Bank Name</label>' +
      '<input type="text" class="field-input" id="c-bank" value="' + (existing ? u.escapeHtml(existing.bankName) : "") + '">' +
      '<label class="field-label">Statement Start Date</label>' +
      '<input type="date" class="field-input" id="c-start" value="' + startDate + '">' +
      '<label class="field-label">Statement End Date</label>' +
      '<input type="date" class="field-input" id="c-end" value="' + endDate + '">' +
      '<p class="field-hint">Amount Payable only counts expenses and payments dated within this range — update these to match each new statement period.</p>' +
      '<label class="field-label">Amount Payable</label>' +
      '<input type="number" inputmode="decimal" step="0.01" class="field-input" id="c-payable" placeholder="0.00" value="' + (existing ? u.formatPlain(existing.startingAmountPayable) : "") + '">' +
      '<p class="field-hint">Rises with expenses on this card, falls when you log a Transfer from a bank account to this card as a bill payment — both scoped to the statement dates above.</p>' +
      (isEdit
        ? '<p class="field-hint">Editing these corrects the starting point only — it does not remove the effect of transactions already linked to this card.</p>'
        : "") +
      (isEdit ? '<button type="button" class="delete-btn" data-action="delete">Delete Credit Card</button>' : "") +
      '<p class="field-error" id="c-error"></p>' +
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
        if (App.derived.hasLinkedTransactions("creditCard", existing.id, txs)) {
          alert("This card has linked transactions and can't be deleted.");
          return;
        }
        if (confirm("Delete this credit card? This cannot be undone.")) {
          App.db.deleteCreditCard(existing.id).then(function () {
            overlay.remove();
            render(container);
          });
        }
      }
    });

    function save() {
      var errorEl = overlay.querySelector("#c-error");
      var bankName = overlay.querySelector("#c-bank").value.trim();
      var statementStart = overlay.querySelector("#c-start").value;
      var statementEnd = overlay.querySelector("#c-end").value;
      var payable = parseFloat(overlay.querySelector("#c-payable").value);

      if (!bankName) {
        errorEl.textContent = "Please enter a bank name.";
        return;
      }
      if (!statementStart || !statementEnd) {
        errorEl.textContent = "Please enter both statement dates.";
        return;
      }
      if (statementStart > statementEnd) {
        errorEl.textContent = "Statement start date must be before the end date.";
        return;
      }
      if (isNaN(payable) || payable < 0) {
        errorEl.textContent = "Please enter a valid amount payable.";
        return;
      }

      var record = {
        id: isEdit ? existing.id : u.uuid(),
        bankName: bankName,
        statementStartDate: statementStart,
        statementEndDate: statementEnd,
        startingAmountPayable: u.round2(payable),
        createdAt: isEdit ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      var op = isEdit ? App.db.updateCreditCard(record) : App.db.addCreditCard(record);
      op.then(function () {
        overlay.remove();
        render(container);
      });
    }
  }

  return { render: render };
})();
