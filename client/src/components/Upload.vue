<template>
    <div class="upload-container">
        <div class="template-text">
            <img alt="codeTom97 logo" class="logo" src="../assets/logo.png">
            <p class="text">Node大文件分片上传 - (自行车轮子)</p>
        </div>
        <!-- 协议选择器 -->
        <div class="protocol-btns">
            <button :class="{cur: protocolCur == 'http' }" @click="selectProtocol('http')">HTTP</button>
            <button :class="{cur: protocolCur == 'websocket' }" @click="selectProtocol('websocket')">WebSocket</button>
        </div>
        <!-- 上传盒子 -->
        <div class="file-upload-box" @click="choiceFile" @drop.prevent="dragFile" @dragover.prevent>
            <div class="file-upload-tips">点击选择文件或者拖拽文件到此</div>
            <div class="file-uplpad-tips-img">
                <img :src="require('../assets/drag.svg')" alt="">
                <span>或者</span>
                <img :src="require('../assets/select.svg')" alt="">
            </div>
            <div class="file-upload-tips">（支持2M到2G的大文件上传）</div>
            <input type="file" ref="fileEl" class="file-input" @change="addFile">
        </div>
        <!-- 上传信息 -->
        <transition name="fade">
            <div class="file-info" v-if="showFileInfo">
                <div class="file-basic-info">
                    <div class="basic-left-info">
                        <img :src="require(`../assets/${fileInfo.type}.svg`)" class="file-abbr" alt />
                        <span class="file-name">{{ fileInfo.name }}</span>
                    </div>
                    <div class="basic-right-info">
                        大小: {{ fileInfo.size + ' ' + fileInfo.unit }}
                    </div>
                </div>
                <!-- 进度条 -->
                <div class="file-upload-progress">
                    <span>{{ progress }}%</span>
                    <div class="progress-container">
                        <div class="progress-par" :style="'width:' + progress + '%'">
                            <div class="progress-bar"></div>
                        </div>
                    </div>
                    <span>{{ chunkDoneTotal }}/{{ chunkTotal }}</span>
                </div>
                <!-- 删除按钮 -->
                <div class="file-close" @click="closeFile">
                    <img class="file-close-svg" :src="require('../assets/close.svg')" />
                </div>
            </div>
        </transition>
        <!-- 底部上传按钮 -->
        <div class="bottom-btn">
            <button @click="submit">开始上传</button>
        </div>
        <transition name="fade">
            <div class="top-upload-tips" :class="tipStatus" v-show="tips">{{ tips }}</div>
        </transition>
    </div>
</template>

<script>
import axios from 'axios';
import SparkMD5 from 'spark-md5';

const zipReg = new RegExp(/^.*(?<=(zip|rar|tar))$/);
const imageReg = new RegExp(/^.*(?<=(jpg|jpeg|png))$/);
const videoReg = new RegExp(/^.*(?<=(mp4|avi|rmvb|flv))$/);

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;
const BlobFileSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice; // 存放分片数据

axios.defaults.baseURL = 'http://127.0.0.1:8888';

export default {
    data() {
        return {
            protocolCur: 'http',        // 上传协议
            showFileInfo: false,        // 是否显示上传文件信息
            isUploading: false,         // 是否开启上传
            file: '',
            fileInfo: {
                name: '',               // 文件名
                type: 'file',           // 文件类型
                size: '',               // 文件大小
                hash: '',               // 文件hash
                unit: ''                // 单位大小
            },
            chunkSize: 2 * MB,          // 最少分割文件大小
            chunkTotal: 0,              // 分割总数
            chunkDoneTotal: 0,          // 已上传分割数
            tipStatus: 'success',       // 弹框类型
            tips: ''                    // 弹窗文字
        }
    },
    computed: {
        // 计算上传进度
        progress() {
            return this.chunkTotal !== 0 ? parseFloat((this.chunkDoneTotal / this.chunkTotal) * 100).toFixed(2) : 0
        }
    },
    methods: {
        /**
         * 选择协议
         */
        selectProtocol(type) {
            this.protocolCur = type
        },
        // 点击上传
        choiceFile() {
            this.$refs.fileEl.click();
        },
        // 拖拽上传
        dragFile(e) {
            const droppedFiles = e.dataTransfer.files;
            if (!droppedFiles) return;
            this.file = droppedFiles[0];
            this.getFile();
        },
        // 手动选择文件
        addFile() {
            this.file = this.$refs.fileEl.files[0];
            this.getFile();
        },
        // 上传文件上传
        closeFile() {
            this.showFileInfo = false;
            this.file = null;
            this.$refs.fileEl.value = ''
            this.chunkTotal = this.chunkDoneTotal = 0;
        },
        // 通过文件大小进行分片, 并计算生成哈希值
        async getFile() {
            if (!this.file) {
                this.updateTips("获取文件失败", "error");
                return false;
            }
    
            this.getFileInfo(this.file); // 获取文本信息

            try {
                await this.createFileHash(this.file); // 创建哈希文件(mixins)
            } catch(e) {
                console.log(e);
            }
        },
        // 获取文件基本信息并显示
        getFileInfo({ name, size }) {
            this.showFileInfo = true;
            this.fileInfo.name = name;

            // 对文件格式初始化
            if (zipReg.test(name)) {
                this.fileInfo.type = 'zip'
            } else if (videoReg.test(name)) {
                this.fileInfo.type = 'video'
            } else if (imageReg.test(name)) {
                this.fileInfo.type = 'image'
            }

            // 对大小进行转换
            if (size >= GB) {
                this.fileInfo.size = parseFloat(size / GB).toFixed(2); // 保留小数点后四位
                this.fileInfo.unit = 'GB';
            } else if (size >= MB) {
                this.fileInfo.size = parseFloat(size / MB).toFixed(2);
                this.fileInfo.unit = 'MB';
            } else if (size >= KB) {
                this.fileInfo.size = parseFloat(size / KB).toFixed(2);
                this.fileInfo.unit = 'KB';
            } else {
                this.fileInfo.size = size;
                this.fileInfo.unit = 'B';
            }
        },
        // 生成分割后hash切片File
        createFileHash(file) {
            const fileSize = file.size;

            // 根据不同的文件大小进行分割
            if (fileSize > 500 * MB) {
                this.chunkSize = 10 * MB;
                this.showChunkSize = true;
            } else if (fileSize > 100 * MB) {
                this.chunkSize = 5 * MB;
                this.showChunkSize = true;
            }
            
            return new Promise((resolve, reject) => {
                const chunks = Math.ceil(fileSize / this.chunkSize); // 获取分割的文件数量, 记录chunks数量
                this.chunkTotal = chunks;

                const spark = new SparkMD5.ArrayBuffer();
                const fileReader = new FileReader(); 
                const _this = this;
                let currentChunk = 0; 

                this.updateTips('开始读取文件计算哈希中，请耐心等待', 'success');

                fileReader.onload = (e) => {

                    spark.append(e.target.result);
                    currentChunk++;

                    if (currentChunk < chunks) {
                        loadNext();
                    } else {
                        _this.chunkTotal = currentChunk;
                        const hash = spark.end();

                        this.fileInfo.hash = hash;          // 记录文件hash
                        this.isUploading = true;            // 开启上传拦截

                        this.updateTips("加载文件成功，文件哈希为" + hash, 'success');

                        resolve(hash);
                    }
                }

                fileReader.onerror = () => {
                    this.updateTips('读取切分文件失败，请重试', 'error');
                    reject('读取切分文件失败，请重试');
                }

                function loadNext() {
                    let start = currentChunk * _this.chunkSize,
                        end = start + _this.chunkSize >= file.size
                            ? file.size
                            : start + _this.chunkSize;
        
                    fileReader.readAsArrayBuffer(BlobFileSlice.call(file, start, end));
                }

                loadNext();
            }).catch((err) => {
                console.log(err);
            });
        },
        // 提交上传
        async submit() {
            if (!this.isUploading) {
                this.updateTips('正在读取文件计算哈希中，请耐心等待', 'warning');
                return false;
            }

            this.chunkDoneTotal = 0;

            if (!this.file) {
                this.updateTips('尚未获取到文件', 'error');
            }

            // 先与服务端检查文件是否已经上传成功过 or 需要断点续传
            const result = await this.checkFileHash();

            if (result?.type === 2) {
                this.updateTips('文件已经上传过了, 请勿重新上传', 'warning');
                return false;
            } else {
                this.updateTips('开始执行分片上传，请勿关闭窗口', 'success');
                // 判断协议决定上传方式
                if (this.protocolCur === 'http') {
                    this.sendFormDataByHttp(this.chunkSize, this.chunkTotal, this.fileInfo, this.file, result);
                } else {
                    console.log('使用socket上传')
                    this.updateTips('socket协议正在逐步完善中', 'warning');
                }
            }
        },
        // 检查分片是否已经上传过
        async checkFileHash() {
            return new Promise((resolve, reject) => {
                const data = {
                    hash: this.fileInfo.hash,
                    total: this.chunkTotal,
                    chunkSize: this.chunkSize
                }

                axios.post('/chunks/check', data)
                    .then(({ data }) => {
                        if (data?.code === 1) {
                            resolve(data?.data);
                        }
                    })
                    .catch(err => {
                        reject(err);
                        this.updateTips(err, 'error');
                    })
            })
        },
        // 通过FormData发送请求
        async sendFormDataByHttp(chunkSize, chunkTotal, fileInfo, file, res) {
            let chunkReqArr = [];

            for (let i = 0; i < chunkTotal; i++) {
                if (res.type === 0 || 
                    (res.type === 1 && 
                        res.index.length > 0 && 
                        !res.index.includes(i.toString())
                    )
                ) {
                    // 记录起始位置与结束位置
                    const start = i * chunkSize;
                    const end = Math.min(file.size, start + this.chunkSize);
                    const form = new FormData();
                    // 组装数据源
                    form.append('file', BlobFileSlice.call(file, start, end))
                    form.append("size", file.size); // 一定要使用源File.size
                    form.append('name', fileInfo.name);
                    form.append("hash", fileInfo.hash);
                    form.append("index", i);
                    form.append("chunkSize", chunkSize);
                    form.append("total", chunkTotal);
                    // 组装分片上传组件
                    const chunkReqItem = axios.post('/chunks/upload', form, {
                        onUploadProgress: (e) => {
                            // 当loaded===total表明该分片上传完成
                            if (e.loaded === e.total) {
                                this.chunkDoneTotal += 1;
                            }
                        }
                    });
                    chunkReqArr.push(chunkReqItem);
                }
            }

            if (chunkReqArr.length <= 10) {
                // 切片数量少的情况可同步发送请求
                Promise.all(chunkReqArr)
                    .then(() => {
                        this.updateTips('分片上传成功，正在执行合并操作', 'success');

                        // 发起合并chunks的请求
                        const data = {
                            chunkSize: this.chunkSize,
                            name: this.fileInfo.name,
                            hash: this.fileInfo.hash,
                            total: this.chunkDoneTotal
                        };

                        this.sendChunksMegre(data);
                    });
            } else {
                for (let i = 0, len = chunkReqArr.length; i < len; i++) {
                    await chunkReqArr[i];
                }

                this.updateTips('分片上传成功，正在执行合并操作', 'success');

                // 发起合并chunks的请求
                const data = {
                    chunkSize: this.chunkSize,
                    name: this.fileInfo.name,
                    hash: this.fileInfo.hash,
                    total: this.chunkDoneTotal
                };

                this.sendChunksMegre(data);
            }
        },
        // 通过长链接发送请求
        sendBlobDataByWebSocket() {},
        // 合并切片请求
        async sendChunksMegre(fileData) {
            try {
                const { data } = await axios.post('/chunks/merge', fileData);
                if (data.code) {
                    this.updateTips('文件分片上传合并成功', 'success');
                    this.chunkDoneTotal = this.chunkTotal;
                    this.isUploading = false;
                }
            } catch(error) {
                this.updateTips(JSON.stringify(error.data.msg), 'error');
            }
        },
        // 更新提示信息
        updateTips(tips, status) {
            this.tips = tips
            this.tipStatus = status;
            if (this.timer) {
                clearTimeout(this.timer);
            }
            this.timer = setTimeout(() => {
                this.tips = ''
            }, 2000)
        }
    }
}
</script>

<style>
.upload-container {
    width: 500px;
    margin: auto;
}

.template-text {
    font-size: 18px;
    color: hotpink;
    text-align: center;
}

.logo {
  width: 120px;
  border-radius: 50%;
}

/* 协议选择器 */
.protocol-btns {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 35px;
}

.protocol-btns button {
    flex: 1;
    font-size: 18px;
    height: 45px;
    line-height: 45px;
    background: #fff;
    border: 2px solid transparent;
    border-radius: 5px;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.05);
    outline: none;
    cursor: pointer;
}

.protocol-btns button + button {
    margin-left: 20px;
}

.protocol-btns button:hover {
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
}

.protocol-btns button.cur {
    color: hotpink;
    border-color: hotpink;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
}


/* 上传盒模型 */
.file-upload-box {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 200px;
    border-radius: 5px;
    border: 2px dashed #909090;
    cursor: pointer;
}

.file-upload-tips {
    font-size: 14px;
    color: #909090;
    padding: 16px 0;
}

.file-upload-tips:last-of-type {
    font-size: 12px;
}

.file-uplpad-tips-img {
    display: flex;
    justify-content: center;
    align-items: center;
}

.file-uplpad-tips-img img {
    width: 40px;
}

.file-uplpad-tips-img span {
    margin: 0 20px;
}

.file-input {
    display: none;
}

/* 上传进度 */
.file-info {
    display: flex;
    flex-direction: column;
    position: relative;
    height: 80px;
    font-size: 14px;
    color: #313131;
    box-shadow: 0 0 15px rgb(0, 0, 0, 0.05);
    border-radius: 5px;
    margin-top: 35px;
    cursor: pointer;
    padding: 0 35px 0 20px;
}

.file-basic-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    line-height: 40px;
    border-bottom: 1px dashed #ddd;
}

/* 对图片特殊处理 */
.basic-left-info {
    display: flex;
    align-items: center;
}
.basic-left-info img {
    width: 22px;
    margin-right: 5px;
}


/* 进度条 */
.file-upload-progress {
  line-height: 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-upload-progress span {
    flex: 1;
}

.progress-container {
    width: 350px;
    height: 15px;
    border-radius: 8px;
    margin: 0 16px;
    background-color: #ccc;
}

.progress-par {
    overflow: hidden;
    height: 100%;
    border-radius: 8px;
}

.progress-bar {
    width: 100%;
    height: 100%;
    background: hotpink;
    border-radius: 8px;
    background-image: repeating-linear-gradient(
        30deg,
        hsla(0, 0%, 100%, 0.1),
        hsla(0, 0%, 100%, 0.1) 15px,
        transparent 0,
        transparent 30px
    );
    animation: progressbar 5s linear infinite;
}

.file-close {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-10px);
}

.file-close img {
    width: 20px;
}

/* 底部按钮 */
.bottom-btn {
    display: flex;
    margin-top: 35px;
}

.bottom-btn button {
    flex: 1;
    font-size: 16px;
    font-weight: 400;
    color: #fff;
    height: 40px;
    background: palevioletred;
    border-radius: 5px;
    border: 2px solid transparent;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.05);
    outline: none;
}

/* 底部提示 */
.top-upload-tips {
    font-size: 14px;
    height: 38px;
    line-height: 38px;
    border-radius: 5px;
    position: fixed;
    top: 3%;
    width: 500px;
}
.top-upload-tips.success {
    color: #67c23a;
    background: #f0f9eb;
    border: 1px solid #c2e7b0;
}
.top-upload-tips.error {
    color: #f56c6c;
    background: #fef0f0;
    border: 1px solid #fbc4c4;
}
.top-upload-tips.warning {
    color: #e6a23c;
    background: #fdf6ec;
    border: 1px solid #f5dab1;
}


/* 动画 */
@keyframes progressbar {
  0% {
    background-position: 0% 0;
  }
  100% {
    background-position: 350px 0;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>