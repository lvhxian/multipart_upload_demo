const fs = require('fs');
const path = require('path');

/**
 * 创建目录
 * @param {*} dirname 
 */
const mkdirsSync = (dirname) => {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}


module.exports = {
    mkdirsSync
}