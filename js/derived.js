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

  // Simulates monthly interest accrual mirroring a real loan: on the 1st of
  // every month since the loan was added, interest (based on the outstanding
  // balance at that point) is added to the principal — not logged as an
  // expense, just folded into the balance. Repayments (logged expenses under
  // the loan's category) are applied in date order alongside those accruals,
  // so paying on time offsets the interest instead of letting it compound.
  function simulateLoanBalance(loan, payments) {
    var monthlyRate = (loan.interestRate || 0) / 12 / 100;
    var startDate = (loan.createdAt || u.todayISO()).slice(0, 10);
    var today = u.todayISO();

    var events = payments.map(function (p) {
      return { date: p.date, type: "payment", amount: p.amount };
    });
    var cursor = u.addMonths(u.startOfMonth(startDate), 1);
    while (cursor <= today) {
      events.push({ date: cursor, type: "accrue" });
      cursor = u.addMonths(cursor, 1);
    }
    events.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.type === b.type) return 0;
      return a.type === "accrue" ? -1 : 1; // interest accrues before that day's payment is applied
    });

    var balance = loan.startingPrincipal || 0;
    events.forEach(function (e) {
      if (e.type === "accrue") balance += balance * monthlyRate;
      else balance -= e.amount;
    });
    return Math.max(0, u.round2(balance));
  }

  function loanState(loan, txs) {
    var payments = [];
    txs.forEach(function (t) {
      if (t.type === "expense" && t.category === loan.name) {
        payments.push({ date: t.date, amount: t.amount });
      }
    });
    var paymentsMade = payments.length;
    var currentPrincipal = simulateLoanBalance(loan, payments);
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
    // Amount Payable is scoped to the card's statement period: only expenses
    // and payments dated within [statementStartDate, statementEndDate] count.
    // Missing dates fall back to "no lower bound" / "through today", so cards
    // created before this field existed keep working unfiltered until edited.
    var start = card.statementStartDate || "0000-01-01";
    var end = card.statementEndDate || u.todayISO();
    var cardExpenses = 0;
    var paymentsToCard = 0;
    txs.forEach(function (t) {
      if (t.date < start || t.date > end) return;
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
