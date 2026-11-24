'use strict';
const { D } = require('../../services/gameData');
const get = (id) => D.rarities[Math.max(1, Math.min(9, id)) - 1];
module.exports = {
  get,
  name: (id) => get(id).name,
  color: (id) => parseInt(get(id).color.slice(1), 16),
  hex: (id) => get(id).color,
  weight: (id) => get(id).weight,
  priceMult: (id) => get(id).priceMult,
  expMult: (id) => get(id).expMult,
  mark: (id) => get(id).mark,
  frameKey: (id) => `khung_${get(id).key}`,
  label: (id) => `${get(id).mark} ${get(id).name}`,
  isRare: (id) => id >= 3,
};
