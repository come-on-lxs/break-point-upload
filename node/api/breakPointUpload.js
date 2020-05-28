const router=require("koa-router")();
const multiparty = require("multiparty");
const path = require("path");
const fse = require("fs-extra");
const UPLOAD_DIR = path.resolve(__dirname, "..", "public/images");

let count = 0;

router.post("/", async ctx => {
    const multipart = new multiparty.Form()
    await new Promise((resolve, reject) => {
        multipart.parse(ctx.req, async (err, fields, files) => {
            if(err) {
                reject(err)
            }
            const [chunk] = files.chunk;
            const [hash] = fields.hash;
            const [name] = fields.name;
            const [length] = fields.length;
            const [size] = fields.size;
            const [fileHash] = fields.fileHash
            const chunkDir = path.resolve(UPLOAD_DIR, fileHash);
            // 切片目录不存在则创建目录
            if(!fse.existsSync(chunkDir)) {
                await fse.mkdirs(chunkDir)
            }
            await fse.move(chunk.path, path.resolve(chunkDir, hash)).then(() => {
                resolve()
            }).catch(e => {
                reject(e)
            });

            count ++;
            // 判断文件长度, 文件全部上传完毕时自动合并文件
            if (count >= length) {
                count = 0
                let mimeType = name.split('.')[1]
                const filePath = path.resolve(UPLOAD_DIR, `${fileHash}.${mimeType}`);
                await mergeFileChunk(filePath, fileHash, size)
            }

        })
    }).then(() => {
        ctx.body = {
            code: 200,
            message: 'success'
        }
    }).catch(e => {
        ctx.body = {
            code: 201,
            message: e.toString()
        }
    })
});

const createUploadedList = async fileHash =>
    fse.existsSync(path.resolve(UPLOAD_DIR, fileHash)) ?
        await fse.readdir(path.resolve(UPLOAD_DIR, fileHash)) : []


// 检测文件是否存在
router.post("/check", async ctx=>{
    let { fileHash, filename } = ctx.request.body;
    let mimetype = filename.split('.')[1]
    let res = await fse.pathExists(path.resolve(UPLOAD_DIR, `${fileHash}.${mimetype}`))
    count = 0
    if (res) {
        ctx.body = {
            code: 200,
            message: '文件上传成功',
            data: []
        }
    } else {
        ctx.body = {
            code: 201,
            data: await createUploadedList(fileHash)
        }
    }
});

const pipeStream = (path, writeStream) => {
    new Promise(resolve => {
        const readStream = fse.createReadStream(path)
        readStream.on('end', () => {
            fse.unlinkSync(path);
            resolve()
        })
        readStream.pipe(writeStream)
    })
};

// 合并切片
const mergeFileChunk = async (filePath, filename, size) => {
    const chunkDir = path.resolve(UPLOAD_DIR, filename);
    const chunkPaths = await fse.readdir(chunkDir);
    chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1]);
    await Promise.all(
        chunkPaths.map((chunkPath, index) => {
            pipeStream(
                path.resolve(chunkDir, chunkPath),
                fse.createWriteStream(filePath, {
                    start: index * size,
                    end: (index + 1) * size
                })
            )
        })
    )
    setTimeout(() => {
        fse.rmdirSync(chunkDir); // 合并后删除保存切片的目录
    }, 100)
};

router.post("/merge", async ctx => {
    let { filename, size } = ctx.request.body;
    const filePath = path.resolve(UPLOAD_DIR, `${Date.now()}-${filename}`);
    await mergeFileChunk(filePath, filename, size).then(() => {
        ctx.body = {
            code: 200,
            message: 'success'
        }
    }).catch(e => {
        console.log(e)
        ctx.body = {
            code: 201,
            message: e.toString()
        }
    });
});


module.exports = router.routes();