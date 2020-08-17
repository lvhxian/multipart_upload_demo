'use strict';

const fs = require('fs');
const path = require('path');
const { streamMerge } = require('split-chunk-merge');
const { mkdirsSync } = require('../utils');

const Controlller = require('egg').Controller;
const uploadPath = path.join(__dirname, '../../uploads');


class HttpController extends Controlller {
  async index() {
    const { ctx } = this;
    ctx.body = 'Node层分片上传';
  }

  // 检查文件是否已上传或断点续传
  async checkHash() {
    const { ctx } = this;
    const { hash, chunkSize, total } = ctx.request.body;
    const chunkPath = path.join(uploadPath, `${hash}-${chunkSize}`, '/');

    if (fs.existsSync(chunkPath)) {
      // 目录存在，判断是否已经上传成功还是需要断点续传
      const chunks = fs.readdirSync(chunkPath);
      // 判断已经存在文件
      if (chunks.length !== 0 && chunks.length === total) {
        ctx.status = 200;
        ctx.body = {
          code: 1,
          msg: '文件在服务器上已存在，不需要重复上传',
          data: {
            type: 2,
          },
        };
      } else {
        // 执行断点续传
        const index = [];

        // 遍历循环已存在的分片下标, 返回到前台
        chunks.forEach(item => {
          const chunksItemArr = item.split('-');
          index.push(chunksItemArr[chunksItemArr.length - 1]);
        });

        ctx.status = 200;
        ctx.body = {
          code: 1,
          msg: `已检查到有分片${index.join(',')}, 需要断点续传`,
          data: {
            type: 1,
            index,
          },
        };
      }
    } else {
      ctx.status = 200;
      ctx.body = {
        code: 1,
        msg: '检查完毕',
        data: {
          type: 0,
        },
      };
    }
  }

  // 分片上传
  async chunksUpload() {
    const { ctx } = this;
    const { hash, index, chunkSize } = ctx.request.body;
    const file = ctx.request.files[0];
    const chunkPath = path.join(uploadPath, `${hash}-${chunkSize}`, '/');

    // 若无存在文件夹则先创建
    if (!fs.existsSync(chunkPath)) mkdirsSync(chunkPath);

    // 利用fs提供的stream, 通过管道写入操作文件写入
    const readStream = fs.createReadStream(file.filepath); // egg.js 都会分配一个临时的filepath
    const writeStream = fs.createWriteStream(`${chunkPath}${hash}-${index}`);

    readStream.pipe(writeStream);

    readStream.on('end', function() {
      fs.unlinkSync(file.filepath); // 删除临时文件
    });

    ctx.status = 200;

    ctx.body = {
      code: 1,
      msg: `上传成功: ${hash}-${index}`,
    };
  }

  // 合并分片请求
  async chunksMerge() {
    const { ctx } = this;
    const { hash, total, chunkSize, name } = ctx.request.body;

    const chunksPath = path.join(uploadPath, hash + '-' + chunkSize, '/');
    const filePath = path.join(uploadPath, name);

    const chunks = fs.readdirSync(chunksPath);
    const chunksList = [];

    // 检查合并的文件是否符合分割总数
    if (chunks.length !== total || chunks.length === 0) {
      ctx.status = 200;
      ctx.body = {
        success: false,
        msg: '切片文件数量与请求不符合，无法合并',
        data: '',
      };
    }

    chunks.forEach(item => {
      chunksList.push(path.join(chunksPath, item));
    });

    try {
      await streamMerge(chunksList, filePath, chunkSize); // 执行合并操作

      ctx.status = 200;

      ctx.body = {
        code: 1,
        msg: '合并成功',
        data: '',
      };

    } catch (e) {
      ctx.status = 500;

      ctx.body = {
        code: 0,
        msg: '合并失败',
        data: '',
      };
    }
  }
}

module.exports = HttpController;
