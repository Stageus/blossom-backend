//==========package============
const express = require("express");
const path = require("path");
const fs = require("fs");
const redis = require("redis").createClient();
//======Init========
const app = express()
const port = 8000

app.use(express.json()) 

app.use(async (err, req, res, next) => { //next 쓰레기통 구현 -> log 추가해야함
    
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