/**
 * Balance calculation services — exact algorithm from specification.
 */

/**
 * Calculate net balance per userId across expenses and settlements.
 * Positive = owed money (creditor), Negative = owes money (debtor).
 */
function calculateBalances(expenses, settlements) {
  const balance = {};

  for (const exp of expenses) {
    // Payer gains credit equal to what they paid (in group currency)
    balance[exp.paidById] = (balance[exp.paidById] || 0) + exp.amountInGroupCurrency;

    // Each split member owes their share
    for (const split of exp.splits) {
      balance[split.userId] = (balance[split.userId] || 0) - split.amount;
    }
  }

  for (const s of settlements) {
    // fromUser paid toUser → fromUser is more positive, toUser is more negative
    balance[s.fromUserId] = (balance[s.fromUserId] || 0) + s.amount;
    balance[s.toUserId]   = (balance[s.toUserId]   || 0) - s.amount;
  }

  return balance;
}

/**
 * Greedy algorithm to simplify debts into minimum transactions.
 * Returns array of { from, to, amount }.
 */
function simplifyDebts(balances) {
  const creditors = [], debtors = [];

  for (const [uid, bal] of Object.entries(balances)) {
    if (bal > 0.01)  creditors.push({ uid, amount: bal });
    if (bal < -0.01) debtors.push({ uid, amount: -bal });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const txns = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const amt = Math.min(creditors[i].amount, debtors[j].amount);
    txns.push({
      from: debtors[j].uid,
      to: creditors[i].uid,
      amount: Math.round(amt * 100) / 100,
    });
    creditors[i].amount -= amt;
    debtors[j].amount   -= amt;
    if (creditors[i].amount < 0.01) i++;
    if (debtors[j].amount   < 0.01) j++;
  }

  return txns;
}

module.exports = { calculateBalances, simplifyDebts };
