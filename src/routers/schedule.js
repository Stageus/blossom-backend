//==========package============
const express = require("express");
const app = express()
const port = 8000

app.use(express.json()) 

require('dotenv').config()

////////////////////////////
const router = require("express").Router()
const jwt = require("jsonwebtoken")
const checkPattern = require("../middleware/checkPattern");
const isBlank = require("../middleware/isBlank");
const { executeSQL } = require("../modules/sql");
const isLogin = require("../middleware/isLogin");

const { idReq,pwReq,nameReq,nicknameReq,imageReq,telReq,dateReq,timestampReq,scheduleReq}= require("../config/patterns");

const conn = require("../config/postgresql");


// 1.get schedule/all 특정 월의 전체 일정 불러오기
// date 형식 어떻게 받을지에 따라 isBlank 혹은 다른 미들웨어 써야할듯

router.get("/test", async(req, res,next) => {
    const result = {
        message : "",
        data : null
    }
    const sql = `INSERT INTO account (id, pw, name, birth, tel, nickname) VALUES
    ('hee', 'password3', 'heehee', '2002-02-09', '010-9876-1111', 'hh')`;
    const values = [];

    const dbResult = await executeSQL(conn, sql, values);

    result.data = dbResult;

    res.status(200).send(result);
})


// TODO : test 하느라 islogin 다 뺐다 -> 나중에 넣자
router.get("/all", isBlank("date"), async(req, res, next) => {
    // const { coupleIdx } = req.user;
    const { coupleIdx } = 1; // test용
    const { date } = req.body; // 년, 월만 받으면됨 --> Year, Month 각각 받는게 나은지?
    
    const result = {
        success : false,
        message : "",
        data : null
    }

    try{
        // date월의 일정 전체 최신순으로 가져오기
        const sql = `SELECT *
                     FROM schedule
                     WHERE is_delete = false AND couple_idx = $1 AND date = $3
                     ORDER BY date ASC`;
                     // date=$3 대신 AND EXTRACT(YEAR FROM date) = $2 AND EXTRACT(MONTH FROM date) = $3
        const values = [coupleIdx, date];

        const dbResult = await executeSQL(conn, sql, values);
        
        // 특정 월의 일정 전체 가져오기 실패시
        if (!dbResult || dbResult.length == 0) {
            result.message = `${date} 날짜에 해당하는 일정이 없거나 접근 권한이 없습니다`;
            // 404 안보내고 그냥 빈 list로 보내겠다
        }
        // 특정 월의 일정 전체 가져오기 성공시
        result.success = true;
        result.data = dbResult;
        result.message = `${date} 날짜의 일정 전체 가져오기 성공`
        res.status(200).send(result);
        
    }catch(e){
        next(e)
    }
})

// 2.get schedule 특정 날짜의 일정 불러오기
router.get("/", checkPattern(dateReq, "date"), async(req, res, next) => {
    // const { coupleIdx } = req.user;
    const { coupleIdx } = 1; // test용
    const { date } = req.body; // 년, 월, 일

    const result = {
        success : false,
        message : '',
        data : null 
    };

    try{
        const sql = "SELECT * FROM schedule WHERE date = $1 AND couple_idx = $2 AND is_delete = false"
        const values = [date, coupleIdx];
        const dbResult = await executeSQL(conn, sql, values);

        // 특정 날짜의 일정 불러오기 실패시
        if (!dbResult || dbResult.length == 0) {
            result.message = `${date} 날짜에 해당하는 일정이 없거나 접근 권한이 없습니다.`
            // 404 안보내고 그냥 빈 list로 보내겠다
        }

        // 특정 날짜의 일정 불러오기 성공시
        else{
            result.message = `${date} 날짜에 해당하는 일정 가져오기 성공`
        }

        result.success = true;
        result.data = dbResult;
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 3.post schedule 일정 추가하기 checkPattern -> dateReq 말고 추가해야함
router.post("/", checkPattern(scheduleReq, "content"), checkPattern(timestampReq, "date"), async(req,res,next) => {
    // const { coupleIdx, accountIdx } = req.user; // isLogin에서 token해석해서 전달
    const { coupleIdx } = 1; // test용
    const { accountIdx } = 1; // test용
    const { content, date } = req.body; // date:YYYY-MM-DDT00:00:00 (timestamp형)

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `INSERT INTO schedule (couple_idx, account_idx, content, date)
                     VALUES ($1, $2, $3, $4)`
        const values = [coupleIdx, accountIdx, content, date]
    
        await executeSQL(conn, sql, values)

        // 일정 추가 성공시
        result.success = true;
        result.message = "일정 추가 성공"
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 4. put feed/:idx 특정 일정 수정하기 -> checkPattern(dateReq, "date") timestamp형 정규식 따로 만들어야함
router.put("/:idx", checkPattern(scheduleReq, "content"), checkPattern(dateReq, "date"), async(req, res, next) => {
    // const { coupleIdx } = req.user;
    const { coupleIdx } = 1; // test용
    const { content, date } = req.body; // date = 년월일시분(timestamp)
    const scheduleIdx = req.params.idx;

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `UPDATE schedule SET content = $1, date = $2 WHERE idx = $3 AND couple_idx = $4`
        const values = [content, date, scheduleIdx, coupleIdx]
        
        await executeSQL(conn, sql, values)

        // 특정 일정 수정 성공시
        result.success = true;
        result.message = `idx가 ${scheduleIdx}인 일정 수정 성공`
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 5.delete schedule/:idx 특정 일정 삭제하기
router.delete("/:idx", async(req, res, next) => {
    // const { coupleIdx }  = req.user;
    const { coupleIdx } = 1; // test용
    const scheduleIdx = req.params.idx;

    const result = {
        success : false,
        message : '',
    };

    try{
        // const sql = "UPDATE schedule SET is_delete = true WHERE idx = $1 AND couple_idx = $2"
        const sql = "DELETE FROM schedule WHERE idx = $1 AND couple_idx = $2"
        const values = [scheduleIdx, coupleIdx]
        await executeSQL(conn, sql, values)

        // 일정 soft delete 성공시
        result.success = true;
        result.message = `idx가 ${feedIdx}인 feed soft delete 성공`
    }catch(e){
        next(e);
    }
})

module.exports = router

/////////////////////////////
app.use("/",router);
//
app.listen(port, () => {
    console.log(`${port}번에서 HTTP 웹서버 실행`);
});