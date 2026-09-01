var App = App || {};

// Computes "current" values for bank accounts / EMIs / loans / credit cards
// live from their starting value + the full transaction ledger, rather than
// mutating stored counters on every save. See plan's "Key Design Decisions".
App.derived = (function () {
  var u = App.utils;

  function bankAccountBalance(account, txs) {
    var balance = account.startingBalance || 0;
    txs.forEach(function (t) {
      if (t.type === "transfer") {
        if (t.toAccountId === account.id) balance += t.amount;
        if (t.fromAccountId === account.id) balance -= t.amount;
      } else if (t.type === "expense" && t.bankAccountId === account.id) {
        balance -= t.amount;
      }
    });
    return u.round2(balance);
  }

  function emiState(emi, txs) {
    var paid = 0;
    var paymentsMade = 0;
    txs.forEach(function (t) {
      if (t.type === "expense" && t.category === emi.name) {
        paid += t.amount;
        paymentsMade += 1;
      }
    });
    return {
      currentPrincipal: Math.max(0, u.round2(emi.startingPrincipal - paid)),
      currentRemainingMonths: Math.max(0, emi.startingRemainingMonths - paymentsMade),
      paymentsMade: paymentsMade,
    };
  }

  function loanState(loan, txs) {
    var paid = 0;
    var paymentsMade = 0;
    txs.forEach(function (t) {
      if (t.type === "expense" && t.category === loan.name) {
        paid += t.amount;
        paymentsMade += 1;
      }
    });
    var currentPrincipal = Math.max(0, u.round2(loan.startingPrincipal - paid));
    var currentTenureMonths = Math.max(0, loan.startingTenureMonths - paymentsMade);
    return {
      currentPrincipal: currentPrincipal,
      currentTenureMonths: currentTenureMonths,
      paymentsMade: paymentsMade,
      currentEMI: u.calculateEMI(currentPrincipal, loan.interestRate, currentTenureMonths),
    };
  }

  function investmentState(investment, txs) {
    var contributed = 0;
    txs.forEach(function (t) {
      if (t.type === "expense" && t.category === investment.name) contributed += t.amount;
    });
    return {
      currentAmount: u.round2((investment.startingAmount || 0) + contributed),
    };
  }

  function computeNetWorth() {
    return Promise.all([
      App.db.getAllInvestments(),
      App.db.getAllLoans(),
      App.db.getAllShortTermEmis(),
      App.db.getAllTransactions(),
    ]).then(function (r) {
      var investments = r[0], loanList = r[1], emis = r[2], txs = r[3];
      var assets = investments.reduce(function (s, i) { return s + investmentState(i, txs).currentAmount; }, 0);
      var liabilities =
        loanList.reduce(function (s, l) { return s + loanState(l, txs).currentPrincipal; }, 0) +
        emis.reduce(function (s, e) { return s + emiState(e, txs).currentPrincipal; }, 0);
      return {
        assets: u.round2(assets),
        liabilities: u.round2(liabilities),
        net: u.round2(assets - liabilities),
      };
    });
  }

  function cardState(card, txs) {
    var cardExpenses = 0;
    var paymentsToCard = 0;
    txs.forEach(function (t) {
      if (t.type === "expense" && t.cardId === card.id) {
        cardExpenses += t.amount;
      } else if (t.type === "transfer" && t.toCardId === card.id) {
        paymentsToCard += t.amount;
      }
    });
    return {
      amountPayable: Math.max(0, u.round2((card.startingAmountPayable || 0) + cardExpenses - paymentsToCard)),
    };
  }

  function hasLinkedTransactions(type, id, txs) {
    return txs.some(function (t) {
      if (type === "bankAccount") {
        return t.bankAccountId === id || t.fromAccountId === id || t.toAccountId === id;
      }
      if (type === "creditCard") {
        return t.cardId === id || t.toCardId === id;
      }
      return false;
    });
  }

  return {
    bankAccountBalance: bankAccountBalance,
    emiState: emiState,
    loanState: loanState,
    investmentState: investmentState,
    computeNetWorth: computeNetWorth,
    cardState: cardState,
    hasLinkedTransactions: hasLinkedTransactions,
  };
})();
