var App = App || {};

App.db = (function () {
  var DB_NAME = "budget-pwa";
  var DB_VERSION = 5;
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("transactions")) {
          var tx = db.createObjectStore("transactions", { keyPath: "id" });
          tx.createIndex("date", "date", { unique: false });
          tx.createIndex("type", "type", { unique: false });
          tx.createIndex("category", "category", { unique: false });
        }
        // "accounts" store holds Bank Accounts (bankName, accountNumber, accountType, startingBalance)
        if (!db.objectStoreNames.contains("accounts")) {
          db.createObjectStore("accounts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("profile")) {
          db.createObjectStore("profile", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("shortTermEmis")) {
          db.createObjectStore("shortTermEmis", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("loans")) {
          db.createObjectStore("loans", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("creditCards")) {
          db.createObjectStore("creditCards", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("budgets")) {
          db.createObjectStore("budgets", { keyPath: "category" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("customCategories")) {
          db.createObjectStore("customCategories", { keyPath: "id" });
        }
      };
      req.onsuccess = function (e) {
        resolve(e.target.result);
      };
      req.onerror = function (e) {
        reject(e.target.error);
      };
    });
    return dbPromise;
  }

  function withStore(storeName, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var result;
        Promise.resolve(fn(store))
          .then(function (r) {
            result = r;
          })
          .catch(reject);
        tx.oncomplete = function () {
          resolve(result);
        };
        tx.onerror = function (e) {
          reject(e.target.error);
        };
      });
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function (e) {
        resolve(e.target.result);
      };
      req.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }

  function put(storeName, obj) {
    return withStore(storeName, "readwrite", function (store) {
      return reqToPromise(store.put(obj));
    });
  }

  function remove(storeName, id) {
    return withStore(storeName, "readwrite", function (store) {
      return reqToPromise(store.delete(id));
    });
  }

  function getAll(storeName) {
    return withStore(storeName, "readonly", function (store) {
      return reqToPromise(store.getAll());
    });
  }

  function clear(storeName) {
    return withStore(storeName, "readwrite", function (store) {
      return reqToPromise(store.clear());
    });
  }

  // Transactions

  function addTransaction(t) {
    return put("transactions", t);
  }

  function updateTransaction(t) {
    return put("transactions", t);
  }

  function deleteTransaction(id) {
    return remove("transactions", id);
  }

  function getAllTransactions() {
    return getAll("transactions");
  }

  function getTransactionsInRange(startISO, endISO) {
    return getAllTransactions().then(function (all) {
      return all
        .filter(function (t) {
          return t.date >= startISO && t.date <= endISO;
        })
        .sort(function (a, b) {
          if (a.date !== b.date) return a.date < b.date ? 1 : -1;
          return a.createdAt < b.createdAt ? 1 : -1;
        });
    });
  }

  // Bank Accounts (stored in the "accounts" object store)

  function addBankAccount(a) {
    return put("accounts", a);
  }

  function updateBankAccount(a) {
    return put("accounts", a);
  }

  function deleteBankAccount(id) {
    return remove("accounts", id);
  }

  function getAllBankAccounts() {
    return getAll("accounts").then(function (all) {
      return all.sort(function (a, b) {
        return (a.bankName || "").localeCompare(b.bankName || "");
      });
    });
  }

  // Profile ("Self")

  function getProfile() {
    return withStore("profile", "readonly", function (store) {
      return reqToPromise(store.get("self"));
    });
  }

  function saveProfile(p) {
    p.id = "self";
    return put("profile", p);
  }

  // Short-term EMIs

  function addShortTermEmi(e) {
    return put("shortTermEmis", e);
  }

  function updateShortTermEmi(e) {
    return put("shortTermEmis", e);
  }

  function deleteShortTermEmi(id) {
    return remove("shortTermEmis", id);
  }

  function getAllShortTermEmis() {
    return getAll("shortTermEmis").then(function (all) {
      return all.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    });
  }

  // Loans

  function addLoan(l) {
    return put("loans", l);
  }

  function updateLoan(l) {
    return put("loans", l);
  }

  function deleteLoan(id) {
    return remove("loans", id);
  }

  function getAllLoans() {
    return getAll("loans").then(function (all) {
      return all.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    });
  }

  // Credit Cards

  function addCreditCard(c) {
    return put("creditCards", c);
  }

  function updateCreditCard(c) {
    return put("creditCards", c);
  }

  function deleteCreditCard(id) {
    return remove("creditCards", id);
  }

  function getAllCreditCards() {
    return getAll("creditCards").then(function (all) {
      return all.sort(function (a, b) {
        return (a.bankName || "").localeCompare(b.bankName || "");
      });
    });
  }

  // Custom categories (user-created via the "Others" option on the Expense form)

  function addCustomCategory(c) {
    return put("customCategories", c);
  }

  function getAllCustomCategories() {
    return getAll("customCategories");
  }

  // Settings (single record, id "app")

  function getSettings() {
    return withStore("settings", "readonly", function (store) {
      return reqToPromise(store.get("app"));
    });
  }

  function saveSettings(s) {
    s.id = "app";
    return put("settings", s);
  }

  // Budgets

  function setBudget(category, amount) {
    return put("budgets", { category: category, amount: amount, updatedAt: new Date().toISOString() });
  }

  function getBudget(category) {
    return withStore("budgets", "readonly", function (store) {
      return reqToPromise(store.get(category));
    });
  }

  function deleteBudget(category) {
    return remove("budgets", category);
  }

  function getAllBudgets() {
    return getAll("budgets");
  }

  // Bulk / import-export

  function exportAll() {
    return Promise.all([
      getAllTransactions(),
      getAllBankAccounts(),
      getProfile(),
      getAllShortTermEmis(),
      getAllLoans(),
      getAllCreditCards(),
      getAllBudgets(),
      getSettings(),
      getAllCustomCategories(),
    ]).then(function (r) {
      return {
        version: 5,
        exportedAt: new Date().toISOString(),
        transactions: r[0],
        accounts: r[1],
        profile: r[2] || null,
        shortTermEmis: r[3],
        loans: r[4],
        creditCards: r[5],
        budgets: r[6],
        settings: r[7] || null,
        customCategories: r[8],
      };
    });
  }

  function importReplace(data) {
    return Promise.all([
      clear("transactions"),
      clear("accounts"),
      clear("profile"),
      clear("shortTermEmis"),
      clear("loans"),
      clear("creditCards"),
      clear("budgets"),
      clear("settings"),
      clear("customCategories"),
    ]).then(function () {
      var ops = [];
      (data.transactions || []).forEach(function (t) {
        ops.push(put("transactions", t));
      });
      (data.accounts || []).forEach(function (a) {
        ops.push(put("accounts", a));
      });
      if (data.profile) ops.push(put("profile", data.profile));
      (data.shortTermEmis || []).forEach(function (e) {
        ops.push(put("shortTermEmis", e));
      });
      (data.loans || []).forEach(function (l) {
        ops.push(put("loans", l));
      });
      (data.creditCards || []).forEach(function (c) {
        ops.push(put("creditCards", c));
      });
      (data.budgets || []).forEach(function (b) {
        ops.push(put("budgets", b));
      });
      if (data.settings) ops.push(put("settings", data.settings));
      (data.customCategories || []).forEach(function (c) {
        ops.push(put("customCategories", c));
      });
      return Promise.all(ops);
    });
  }

  return {
    addTransaction: addTransaction,
    updateTransaction: updateTransaction,
    deleteTransaction: deleteTransaction,
    getAllTransactions: getAllTransactions,
    getTransactionsInRange: getTransactionsInRange,
    addBankAccount: addBankAccount,
    updateBankAccount: updateBankAccount,
    deleteBankAccount: deleteBankAccount,
    getAllBankAccounts: getAllBankAccounts,
    getProfile: getProfile,
    saveProfile: saveProfile,
    addShortTermEmi: addShortTermEmi,
    updateShortTermEmi: updateShortTermEmi,
    deleteShortTermEmi: deleteShortTermEmi,
    getAllShortTermEmis: getAllShortTermEmis,
    addLoan: addLoan,
    updateLoan: updateLoan,
    deleteLoan: deleteLoan,
    getAllLoans: getAllLoans,
    addCreditCard: addCreditCard,
    updateCreditCard: updateCreditCard,
    deleteCreditCard: deleteCreditCard,
    getAllCreditCards: getAllCreditCards,
    addCustomCategory: addCustomCategory,
    getAllCustomCategories: getAllCustomCategories,
    getSettings: getSettings,
    saveSettings: saveSettings,
    setBudget: setBudget,
    getBudget: getBudget,
    deleteBudget: deleteBudget,
    getAllBudgets: getAllBudgets,
    exportAll: exportAll,
    importReplace: importReplace,
  };
})();
