'use strict';

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

/**
 * 创建目录
 * @param {*} dirname 文件夹名
 */
const mkdirsSync = dirname => {
  if (fs.existsSync(dirname)) {
    return true;
  }

  if (mkdirsSync(path.dirname(dirname))) {
    fs.mkdirSync(dirname);
    return true;
  }

};

/**
 * 把Bolb文件转换成stream流
 * @param {*} binary blob文件
 */
const bufferToStream = binary => {
  const readableInstanceStream = new Readable({
    read() {
      this.push(binary);
      this.push(null);
    },
  });
  return readableInstanceStream;
};

module.exports = {
  mkdirsSync,
  bufferToStream,
};
