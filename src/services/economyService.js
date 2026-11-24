'use strict';
const wallet = require('../database/repositories/wallet');
const { GameError } = require('../utils/errors');
const { xu } = require('../utils/format');

const int = (n) => { const v = Math.floor(n); if (!Number.isFinite(v)) throw new GameError('Số tiền không hợp lệ'); return v; };
const balance = (userId, code = 'xu') => wallet.balance(userId, code);
/** Cộng tiền (luôn trong giao dịch của người gọi). Trả về số dư mới, hoặc null nếu idem đã được xử lý. */
function credit(userId, amount, type, opts = {}) { amount = int(amount); if (amount < 0) throw new GameError('Số tiền không hợp lệ'); if (amount === 0) return balance(userId, opts.code); return wallet.apply(userId, amount, type, opts); }
/** Trừ tiền: ném lỗi nếu không đủ. */
function debit(userId, amount, type, opts = {}) {
  amount = int(amount); if (amount < 0) throw new GameError('Số tiền không hợp lệ'); if (amount === 0) return balance(userId, opts.code);
  const r = wallet.apply(userId, -amount, type, opts);
  if (r === false) throw new GameError(`Bạn không đủ xu (cần **${xu(amount)}**, đang có **${xu(balance(userId, opts.code))}**).`, 'FUNDS');
  return r;
}
const canAfford = (userId, amount) => balance(userId) >= amount;
module.exports = { balance, credit, debit, canAfford, history: wallet.history, historyCount: wallet.historyCount };
