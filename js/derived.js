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
      outstandingBalance: u.round2((card.startingOutstandingBalance || 0) + cardExpenses),
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
    cardState: cardState,
    hasLinkedTransactions: hasLinkedTransactions,
  };
})();
