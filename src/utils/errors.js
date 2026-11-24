'use strict';
/** Lỗi nghiệp vụ: thông điệp được hiển thị trực tiếp cho người chơi. */
class GameError extends Error {
  constructor(message, code = 'GAME') { super(message); this.name = 'GameError'; this.code = code; }
}
const fail = (message, code) => { throw new GameError(message, code); };
module.exports = { GameError, fail };
