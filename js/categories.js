var App = App || {};

App.categories = {
  INCOME: ["Salary", "Gift"],
  EVERYDAY: ["Dining out", "Food & Groceries", "Travel", "Apparel", "Entertainment", "Loan Repayment", "Rent", "Investments", "Gift", "Household", "Health"],
  TRIP: ["Travel Tickets", "Event Tickets", "Stay", "Food", "Shopping", "Travel"],
  MODES: ["UPI", "Credit Card", "Debit Card", "Cash"],
  LOAN_TYPES: ["Home", "Vehicle", "Others"],
  ACCOUNT_TYPES: ["Savings", "Current"],

  // One-time, idempotent fixups for categories that were renamed after some
  // users may already have data using the old name. Safe to run on every boot.
  RENAMES: { "Dining": "Dining out" },

  runMigrations: function () {
    var RENAMES = App.categories.RENAMES;
    return App.db.getAllTransactions().then(function (all) {
      var toUpdate = all.filter(function (t) { return t.type === "expense" && RENAMES[t.category]; });
      return Promise.all(
        toUpdate.map(function (t) {
          t.category = RENAMES[t.category];
          return App.db.updateTransaction(t);
        })
      );
    }).then(function () {
      var oldNames = Object.keys(RENAMES);
      return Promise.all(
        oldNames.map(function (oldName) {
          return App.db.getBudget(oldName).then(function (b) {
            if (!b) return;
            return App.db.deleteBudget(oldName).then(function () {
              return App.db.setBudget(RENAMES[oldName], b.amount);
            });
          });
        })
      );
    });
  },

  // Expense categories depend on expenseType: Everyday is the base list plus
  // every Short-term EMI/Loan name plus any user-created custom categories for
  // that type; Trip is its fixed list plus custom Trip categories. The special
  // "Others" chip (user types a name) is added by the form itself, not here.
  expenseCategoriesAsync: function (expenseType) {
    return App.db.getAllCustomCategories().then(function (allCustom) {
      var customNames = allCustom
        .filter(function (c) { return c.expenseType === expenseType; })
        .map(function (c) { return c.name; });

      if (expenseType === "Trip") {
        return App.categories.TRIP.concat(customNames);
      }
      return Promise.all([App.db.getAllShortTermEmis(), App.db.getAllLoans()]).then(function (r) {
        var emiNames = r[0].map(function (e) { return e.name; });
        var loanNames = r[1].map(function (l) { return l.name; });
        return App.categories.EVERYDAY.concat(emiNames, loanNames, customNames);
      });
    });
  },

  // Given free text typed into the "Others" field, either reuses an existing
  // category with the same name (case-insensitive) or persists it as a new
  // custom category for that expense type so it's offered again next time.
  resolveOrCreateCustomCategory: function (name, expenseType) {
    var trimmed = name.trim();
    return App.categories.expenseCategoriesAsync(expenseType).then(function (list) {
      var lower = trimmed.toLowerCase();
      var existing = list.find(function (c) { return c.toLowerCase() === lower; });
      if (existing) return existing;
      var record = { id: App.utils.uuid(), name: trimmed, expenseType: expenseType, createdAt: new Date().toISOString() };
      return App.db.addCustomCategory(record).then(function () { return trimmed; });
    });
  },

  // Validates a proposed loan/EMI name doesn't collide with the base
  // category lists, another loan/EMI's name, or a custom category
  // (case-insensitive), so the category-based link stays unambiguous.
  isNameAvailable: function (name, excludeId) {
    var lower = name.trim().toLowerCase();
    var baseLists = App.categories.EVERYDAY.concat(App.categories.TRIP);
    if (baseLists.some(function (c) { return c.toLowerCase() === lower; })) return Promise.resolve(false);
    return Promise.all([App.db.getAllShortTermEmis(), App.db.getAllLoans(), App.db.getAllCustomCategories()]).then(function (r) {
      var nameCollision = r[0].concat(r[1]).some(function (item) {
        return item.id !== excludeId && item.name.toLowerCase() === lower;
      });
      var customCollision = r[2].some(function (c) { return c.name.toLowerCase() === lower; });
      return !nameCollision && !customCollision;
    });
  },
};
