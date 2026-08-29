var App = App || {};

App.categories = {
  INCOME: ["Salary", "Gift"],
  EVERYDAY: ["Dining", "Travel", "Apparel", "Loan Repayment", "Rent", "Investments", "Gift", "Household", "Health"],
  TRIP: ["Travel Tickets", "Event Tickets", "Stay", "Food", "Shopping", "Travel"],
  MODES: ["UPI", "Credit Card", "Debit Card", "Cash"],
  LOAN_TYPES: ["Home", "Vehicle", "Others"],
  ACCOUNT_TYPES: ["Savings", "Current"],

  // Expense categories depend on expenseType: "Trip" is a fixed list; Everyday
  // (default) is the base list plus every Short-term EMI and Loan's own name
  // (see plan's linkage design).
  expenseCategoriesAsync: function (expenseType) {
    if (expenseType === "Trip") return Promise.resolve(App.categories.TRIP.slice());
    return Promise.all([App.db.getAllShortTermEmis(), App.db.getAllLoans()]).then(function (r) {
      var emiNames = r[0].map(function (e) { return e.name; });
      var loanNames = r[1].map(function (l) { return l.name; });
      return App.categories.EVERYDAY.concat(emiNames, loanNames);
    });
  },

  // Validates a proposed loan/EMI name doesn't collide with the base
  // category lists or another loan/EMI's name (case-insensitive), so the
  // category-based link between a loan and its repayments stays unambiguous.
  isNameAvailable: function (name, excludeId) {
    var lower = name.trim().toLowerCase();
    var baseLists = App.categories.EVERYDAY.concat(App.categories.TRIP);
    if (baseLists.some(function (c) { return c.toLowerCase() === lower; })) return Promise.resolve(false);
    return Promise.all([App.db.getAllShortTermEmis(), App.db.getAllLoans()]).then(function (r) {
      var all = r[0].concat(r[1]);
      return !all.some(function (item) {
        return item.id !== excludeId && item.name.toLowerCase() === lower;
      });
    });
  },
};
