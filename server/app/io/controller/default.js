'use strict';
const path = require('path');
const fs = require('fs');
const uploadPath = path.join(__dirname, '../../../uploads');
const {
  streamMerge,
} = require('split-chunk-merge');
const {
  mkdirsSync,
  bufferToStream,
} = require('../../utils');

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
    const {
      ctx,
      app,
    } = this;
    const nsp = app.io.of('/');
    const message = ctx.args[0] || {};

    const {
      chunkSize,
      name,
      total,
      hash,
    } = message;
    // 根据hash值，获取分片文件。
    // 创建存储文件
    // 合并
    const chunksPath = path.join(uploadPath, hash + '-' + chunkSize, '/');
    const filePath = path.join(uploadPath, name);
    // 读取所有的chunks 文件名存放在数组中
    const chunks = fs.readdirSync(chunksPath);
    const chunksPathList = [];
    if (chunks.length !== total || chunks.length === 0) {
      nsp.emit('done', {
        success: false,
        msg: '切片文件数量与请求不符合，无法合并',
      });
    }
    chunks.forEach(item => {
      chunksPathList.push(path.join(chunksPath, item));
    });

    // const writeStream = fs.createWriteStream(filePath);
    streamMerge(chunksPathList, filePath, chunkSize).then(() => {
      nsp.emit('done', {
        success: false,
        msg: '切片文件数量与请求不符合，无法合并',
      });
    }).catch(() => {
      nsp.emit('done', {
        success: false,
        msg: '合并失败，请重试',
      });
    });
  }
}


module.exports = IoController;
