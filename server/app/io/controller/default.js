'use strict';
const path = require('path');
const fs = require('fs');
const { streamMerge } = require('split-chunk-merge');
const {
  mkdirsSync,
  bufferToStream,
} = require('../../utils');

const uploadPath = path.join(__dirname, '../../../uploads');
const Controller = require('egg').Controller;


class IoController extends Controller {
  async upload() {
    const { ctx, app } = this;
    const IO = app.io.of('/'); // 获取指定命名空间的socket
    const message = ctx.args[0] || {};

    try {
      const { file, hash, chunkSize, index } = message;
      const chunkPath = path.join(uploadPath, `${hash}-${chunkSize}`, '/');

      if (!fs.existsSync(chunkPath)) mkdirsSync(chunkPath);

      const readStream = bufferToStream(file);
      const writeStream = fs.createWriteStream(`${chunkPath}${hash}-${index}`);

      // 通过管道传输
      readStream.pipe(writeStream);
      // 传输完毕后发送socket通知
      readStream.on('end', () => {
        IO.emit('uploaded', {
          code: 1,
        });
      });

    } catch (error) {
      app.logger.error(error);
    }
  }

  /**
   * 合并分片
   */
  async merge() {
    const { ctx, app } = this;
    const nsp = app.io.of('/');
    const message = ctx.args[0] || {};

    const { chunkSize, name, total, hash } = message;
    const chunkPath = path.join(uploadPath, `${hash}-${chunkSize}`, '/');
    const filePath = path.join(uploadPath, name);


    const chunks = fs.readdirSync(chunkPath);
    const chunksPathList = [];

    // 检查合并的文件是否符合分割总数
    if (chunks.length === 0 || chunks.length !== total) {
      nsp.emit('done', {
        code: 0,
        msg: '切片文件数量与请求不符合，无法合并',
      });
    }

    chunks.forEach(item => {
      chunksPathList.push(path.join(chunkPath, item));
    });

    // 执行合并操作
    try {
      await streamMerge(chunksPathList, filePath, chunkSize);
      nsp.emit('done', {
        code: 1,
        msg: '合并成功',
      });
    } catch (e) {
      nsp.emit('done', {
        code: 0,
        msg: '合并失败',
      });
    }
  }
}


module.exports = IoController;
