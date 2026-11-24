'use strict';
/** Danh sách màn hình (view) – mỗi view: render(ctx,args) + act(ctx,act,args,i) + modal(ctx,act,args,fields). */
const views = {
  ...require('./views/profile'), ...require('./views/gear'), ...require('./views/bag'), ...require('./views/shop'), ...require('./views/pets'), ...require('./views/admin'),
};
module.exports = views;
