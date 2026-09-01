var App = App || {};

App.investments = (function () {
  var u = App.utils;
  var cats = App.categories;

  function render(container) {
    Promise.all([App.db.getAllInvestments(), App.db.getAllTransactions()]).then(function (r) {
      var investments = r[0], txs = r[1];

      container.innerHTML =
        '<div class="section-header">Investments</div>' +
        '<div class="item-list">' +
        (investments.length
          ? investments.map(function (i) { return rowHtml(i, txs); }).join("")
          : '<div class="empty-list">No investments yet.</div>') +
        "</div>" +
        '<button type="button" class="secondary-btn" id="add-investment-btn">+ Add Investment</button>';

      container.querySelectorAll("[data-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var inv = investments.find(function (i) { return i.id === row.getAttribute("data-id"); });
          if (inv) openForm(inv, container);
        });
      });
      container.querySelector("#add-investment-btn").addEventListener("click", function () {
        openForm(null, container);
      });
    });
  }

  function rowHtml(i, txs) {
    var s = App.derived.investmentState(i, txs);
    return (
      '<div class="item-row" data-id="' + i.id + '">' +
      '<div class="item-main">' +
      '<div class="item-title">' + u.escapeHtml(i.name) + "</div>" +
      "</div>" +
      '<div class="item-value">' + u.formatCurrency(s.currentAmount) + "</div>" +
      "</div>"
    );
  }

  function openForm(existing, container) {
    var isEdit = !!existing;
    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>" + (isEdit ? "Edit Investment" : "Add Investment") + "</h2>" +
      '<button type="button" class="form-save" data-action="save">Save</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<label class="field-label">Name</label>' +
      '<input type="text" class="field-input" id="i-name" placeholder="e.g. Index Fund" value="' + (existing ? u.escapeHtml(existing.name) : "") + '">' +
      '<p class="field-hint">This name becomes an Expense category — log contributions under it and they’ll add to this investment’s total automatically.</p>' +
      '<label class="field-label">Current Amount</label>' +
      '<input type="number" inputmode="decimal" step="0.01" class="field-input" id="i-amount" placeholder="0.00" value="' + (existing ? u.formatPlain(existing.startingAmount) : "") + '">' +
      (isEdit
        ? '<p class="field-hint">Editing this corrects the starting point only — it does not remove the effect of contributions already logged.</p>'
        : "") +
      (isEdit ? '<button type="button" class="delete-btn" data-action="delete">Delete Investment</button>' : "") +
      '<p class="field-error" id="i-error"></p>' +
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
        if (confirm("Delete this investment? This cannot be undone. Past transactions keep their category.")) {
          App.db.deleteInvestment(existing.id).then(function () {
            overlay.remove();
            render(container);
          });
        }
      }
    });

    function save() {
      var errorEl = overlay.querySelector("#i-error");
      var name = overlay.querySelector("#i-name").value.trim();
      var amount = parseFloat(overlay.querySelector("#i-amount").value);

      if (!name) {
        errorEl.textContent = "Please enter a name.";
        return;
      }
      if (isNaN(amount) || amount < 0) {
        errorEl.textContent = "Please enter a valid amount.";
        return;
      }

      cats.isNameAvailable(name, isEdit ? existing.id : null).then(function (available) {
        if (!available) {
          errorEl.textContent = "That name is already used by another category, EMI, loan, or investment. Choose a unique name.";
          return;
        }
        var oldName = isEdit ? existing.name : null;
        var record = {
          id: isEdit ? existing.id : u.uuid(),
          name: name,
          startingAmount: u.round2(amount),
          createdAt: isEdit ? existing.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        var op = isEdit ? App.db.updateInvestment(record) : App.db.addInvestment(record);
        op.then(function () {
          if (isEdit && oldName && oldName !== name) return cats.cascadeRenameCategory(oldName, name);
        }).then(function () {
          overlay.remove();
          render(container);
        });
      });
    }
  }

  return { render: render };
})();
