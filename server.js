//==========package============
const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const makeLog = require('./src/modules/makelog');
const redis = require("redis").createClient();
//======Init========
const app = express()
const port = 8000
const httpsPort = 8443

app.use(express.json()) 

app.use(async (err, req, res, next) => {
    const logData = {
        timestamp: new Date(),
        message: err.message || '서버 오류',
        status: err.status || 500,
    };

    await makeLog(req, res, logData, next);
    
    res.status(err.status || 500).send({
        success: false,
        message: err.message || '서버 오류',
        data: null,
    });
});

//======Web Server======
app.listen(port, () => {
    console.log(`${port}번에서 HTTP 웹서버 실행`);
});
https.createServer(options, app).listen(httpsPort, () => { //https 서버
    console.log(`${httpsPort}번에서 HTTPS 웹서버 실행`); // 포트 수정
});