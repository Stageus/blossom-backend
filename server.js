//==========package============
const express = require("express");
const makeLog = require('./src/modules/makelog');
//======Init========
const app = express()
const port = 8000

app.use(express.json()) 

require('dotenv').config()

const accountApi = require("./src/routers/account") // 소현
app.use("/account", accountApi)

const commentApi = require("./src/routers/comment") // 희주
app.use("/comment", commentApi)

const coupleApi = require("./src/routers/couple") // 소현
app.use("/couple", coupleApi)

const feedApi = require("./src/routers/feed") // 희주
app.use("/feed", feedApi)

const questionApi = require("./src/routers/question") // 소현
app.use("/question", questionApi)

const scheduleApi = require("./src/routers/schedule") // 희주
app.use("/schedule", scheduleApi)

// 공통 로깅 함수
async function logError(req, res, err) {
    const logData = {
        timestamp: new Date(),
        message: err.message || '서버 오류',
        status: err.status || 500,
    };

    await makeLog(req, res, logData);
    
    res.status(err.status || 500).send({
        success: false,
        message: err.message || '서버 오류',
        data: null,
    });
}

// 오류 처리 미들웨어
app.use(async (err, req, res, next) => {
    await logError(req, res, err);
});

//======Web Server======
app.listen(port, () => {
    console.log(`${port}번에서 HTTP 웹서버 실행`);
});