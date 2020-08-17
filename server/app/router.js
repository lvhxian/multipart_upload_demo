'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.http.index);
  router.post('/chunks/check', controller.http.checkHash);
  router.post('/chunks/upload', controller.http.chunksUpload);
  router.post('/chunks/merge', controller.http.chunksMerge);
};
