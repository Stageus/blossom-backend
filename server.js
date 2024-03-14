//==========package============
const express = require("express");
const path = require("path");
const fs = require("fs");
const redis = require("redis").createClient();
//======Init========
const app = express()
const port = 8000

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