'use strict';
const U = require('../util');
const mk = (name, description, mode) => U.simple({ name, description, view: 'workshop', args: () => [mode] });
module.exports = [
  U.simple({ name: 'cancau', description: 'Quản lý cần câu: trang bị, sửa, khoá, đổi ngoại hình, phụ kiện', view: 'rod' }),
  mk('nangcap', 'Nâng cấp cấp độ cần câu bằng vật liệu và xu', 'upgrade'),
  mk('cuonghoa', 'Cường hoá cần câu (+1 … +15)', 'enhance'),
  mk('khamda', 'Khảm hoặc gỡ ngọc cho cần câu', 'socket'),
  mk('thuctinh', 'Thức tỉnh cần câu (3 giai đoạn)', 'awaken'),
  mk('chetao', 'Chế tạo cần câu và vật phẩm từ nguyên liệu', 'craft'),
];
