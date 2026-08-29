var App = App || {};

App.budgets = (function () {
  var u = App.utils;

  function computeBudgetSummary() {
    var start = u.startOfMonth(u.todayISO());
    var end = u.todayISO();
    return Promise.all([App.db.getAllBudgets(), App.db.getTransactionsInRange(start, end)]).then(function (r) {
      var totalBudget = r[0].reduce(function (s, b) { return s + b.amount; }, 0);
      var spentThisMonth = r[1].reduce(function (s, t) {
        if (t.type === "expense" && (t.expenseType || "Everyday") === "Everyday") return s + t.amount;
        return s;
      }, 0);
      return {
        totalBudget: u.round2(totalBudget),
        spentThisMonth: u.round2(spentThisMonth),
        remaining: u.round2(totalBudget - spentThisMonth),
      };
    });
  }

  function openPlanningScreen() {
    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    document.body.appendChild(overlay);
    renderScreen(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.getAttribute("data-action") === "close") {
        overlay.remove();
        if (App.trends) App.trends.render();
      }
    });
  }

  function renderScreen(overlay) {
    Promise.all([App.categories.expenseCategoriesAsync("Everyday"), App.db.getAllBudgets()]).then(function (r) {
      var categoryList = r[0];
      var budgetMap = {};
      r[1].forEach(function (b) { budgetMap[b.category] = b.amount; });
      var total = r[1].reduce(function (s, b) { return s + b.amount; }, 0);

      overlay.innerHTML =
        '<div class="form-modal">' +
        '<div class="form-header">' +
        '<button type="button" class="form-cancel" data-action="close">Close</button>' +
        "<h2>Budget Planning</h2>" +
        '<span style="width:52px;"></span>' +
        "</div>" +
        '<div class="form-body">' +
        '<div class="section-header">Budget (Monthly)</div>' +
        '<div class="computed-value">' + u.formatCurrency(total) + "</div>" +
        '<div class="section-header" style="margin-top:24px;">Categories</div>' +
        '<div class="item-list" id="budget-cat-list">' +
        categoryList
          .map(function (c) {
            return (
              '<div class="item-row" data-category="' + u.escapeHtml(c) + '">' +
              '<div class="item-title">' + u.escapeHtml(c) + "</div>" +
              '<div class="item-value">' + (budgetMap[c] != null ? u.formatCurrency(budgetMap[c]) : '<span class="placeholder">Not set</span>') + "</div>" +
              "</div>"
            );
          })
          .join("") +
        "</div>" +
        "</div>" +
        "</div>";

      overlay.querySelectorAll("[data-category]").forEach(function (row) {
        row.addEventListener("click", function () {
          var category = row.getAttribute("data-category");
          openAmountForm(category, budgetMap[category], overlay);
        });
      });
    });
  }

  function openAmountForm(category, currentAmount, parentOverlay) {
    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>" + u.escapeHtml(category) + "</h2>" +
      '<button type="button" class="form-save" data-action="save">Save</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<label class="field-label">Monthly Budget</label>' +
      '<input type="number" inputmode="decimal" step="0.01" min="0" class="field-input" id="b-amount" placeholder="0.00" value="' + (currentAmount != null ? u.formatPlain(currentAmount) : "") + '">' +
      (currentAmount != null ? '<button type="button" class="delete-btn" data-action="delete">Remove Budget</button>' : "") +
      '<p class="field-error" id="b-error"></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (e.target === overlay || action === "close") {
        overlay.remove();
      } else if (action === "save") {
        var errorEl = overlay.querySelector("#b-error");
        var amount = parseFloat(overlay.querySelector("#b-amount").value);
        if (isNaN(amount) || amount < 0) {
          errorEl.textContent = "Please enter a valid amount.";
          return;
        }
        App.db.setBudget(category, u.round2(amount)).then(function () {
          overlay.remove();
          renderScreen(parentOverlay);
        });
      } else if (action === "delete") {
        App.db.deleteBudget(category).then(function () {
          overlay.remove();
          renderScreen(parentOverlay);
        });
      }
    });
  }

  return {
    computeBudgetSummary: computeBudgetSummary,
    openPlanningScreen: openPlanningScreen,
  };
})();
