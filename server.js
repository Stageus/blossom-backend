//==========package============
const express = require("express");
const path = require("path");
const fs = require("fs");
const redis = require("redis").createClient();
//======Init========
const app = express()
const port = 8000

app.use(express.json()) 

//======Web Server======
app.listen(port, () => {
    console.log(`${port}번에서 HTTP 웹서버 실행`);
});