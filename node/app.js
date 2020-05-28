const Koa = require("koa")
const router=require("koa-router")()
const cors=require("@koa/cors")
const bodyParser  = require("koa-bodyparser")

const app = new Koa()

app
    .use(cors())
    .use(bodyParser())


const breakPoint = require("./api/breakPointUpload")
router.use('/upload', breakPoint)

app.use(router.routes()).use(router.allowedMethods())

app.listen('8007',()=>{
    console.log(`listening on : http:127.0.0.1:8007`);
});
