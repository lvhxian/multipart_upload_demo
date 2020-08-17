'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller, io } = app;
  router.get('/', controller.http.index);
  router.post('/chunks/check', controller.http.checkHash);
  router.post('/chunks/upload', controller.http.chunksUpload);
  router.post('/chunks/merge', controller.http.chunksMerge);

  // socket.io
  io.of('/').route('upload', io.controller.default.upload);
  io.of('/').route('merge', io.controller.default.merge);
};
