'use strict';
const K = require('./kit');
const { F } = K;
/** Mô tả kết quả dùng vật phẩm (itemService.use). */
function describeUse(r) {
  switch (r.kind) {
    case 'chest': return `📦 Mở ${r.qty} rương: +${F.xu(r.xu)}${Object.keys(r.items).length ? `, ${K.itemsText(r.items)}` : ''}`;
    case 'potion': return `🧪 Đã uống bình: +${r.value} ${r.stat} đến ${F.rel(r.until)}`;
    case 'egg': return `🥚 Nở ra **${r.pet.name}** (${K.rar(r.pet.rarity)})!`;
    case 'petfood': return `🍖 Thú cưng nhận +${F.num(r.exp)} EXP${r.up ? ` và lên cấp ${r.up.level}!` : ''}`;
    case 'expand': return `🎒 Kho đồ mở rộng lên **${r.capacity}** ô.`;
    case 'repair': return `🔧 Cần câu được sửa +${r.amount} độ bền.`;
    default: return 'Đã dùng.';
  }
}
module.exports = { describeUse };
