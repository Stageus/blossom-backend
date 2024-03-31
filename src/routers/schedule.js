const router = require("express").Router()
const jwt = require("jsonwebtoken")
const checkPattern = require("../middleware/checkPattern");
const isBlank = require("../middleware/isBlank");
const { executeSQL } = require("../modules/sql");
const isLogin = require("../middleware/isLogin");
const { isMycouple } = require("../modules/isMycouple");

const { idReq,pwReq,nameReq,nicknameReq,imageReq,telReq,dateReq,timestampReq,scheduleReq}= require("../config/patterns");

const conn = require("../config/postgresql");

const {loggingMiddleware} = require("../config/mongodb")
router.use(loggingMiddleware);

// 1.get schedule/all 특정 월의 전체 일정 불러오기
// TODO : coupleIdx는 islogin 추가해서 req.user에서 받아오도록 하기
// TODO : req.body에서 date를 받을건지 year,month를 받을건지 결정하고 그에대한 정규식 체크 미들웨어 추가하기
router.get("/all", async(req, res, next) => {
    // const { coupleIdx } = req.user;
    const { coupleIdx } = req.body; // test용
    const { year,month } = req.body; // 년, 월만 받으면됨 --> Year, Month 각각 받는게 나은지?
    
    const result = {
        success : false,
        message : "",
        data : null
    }

    try{
        // date월의 일정 전체 최신순으로 가져오기
        const sql = `SELECT *
                     FROM schedule
                     WHERE is_delete = false AND couple_idx = $1
                     AND EXTRACT(YEAR FROM date) = $2
                     AND EXTRACT(MONTH FROM date) = $3
                     ORDER BY date ASC`;
        const values = [ coupleIdx, year, month ];

        const dbResult = await executeSQL(conn, sql, values);
        
        // 특정 월의 일정 전체 가져오기 실패시
        if (!dbResult || dbResult.length == 0) {
            result.message = `${year}-${month} 날짜에 해당하는 일정이 없거나 접근 권한이 없습니다`;
            // 404 안보내고 그냥 빈 list로 보내겠다
        }
        // 특정 월의 일정 전체 가져오기 성공시
        result.success = true;
        result.data = dbResult;
        result.message = `${year}-${month} 날짜의 일정 전체 가져오기 성공`
        res.status(200).send(result);
        
    }catch(e){
        next(e)
    }
})

// 2.get schedule 특정 날짜의 일정 불러오기
// TODO : coupleIdx는 islogin 추가해서 req.user에서 받아오도록 하기
// date는 년,월,일 까지 => FE에서 년/월/일 따로 받아서 비교하는게 편할까
// TODO : req.body에서 date를 받을건지 year,month를 받을건지 결정하고 그에대한 정규식 체크 미들웨어 추가하기
router.get("/", async(req, res, next) => {
    // const { coupleIdx } = req.user;
    const { coupleIdx } = req.body; // test용
    const { year, month, day } = req.body; // 년, 월, 일

    const result = {
        success : false,
        message : '',
        data : null 
    };

    try{
        const sql = `SELECT * FROM schedule WHERE EXTRACT(YEAR FROM date) = $1
                     AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(DAY FROM date) = $3
                     AND couple_idx = $4 AND is_delete = false`
        const values = [ year, month, day, coupleIdx ];
        const dbResult = await executeSQL(conn, sql, values);

        // 특정 날짜의 일정 불러오기 실패시
        if (!dbResult || dbResult.length == 0) {
            result.message = `${year}-${month}-${day} 날짜에 해당하는 일정이 없거나 접근 권한이 없습니다.`
            // 404 안보내고 그냥 빈 list로 보내겠다
        }

        // 특정 날짜의 일정 불러오기 성공시
        else{
            result.message = `${year}-${month}-${day} 날짜에 해당하는 일정 가져오기 성공`
        }

        result.success = true;
        result.data = dbResult;
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 3.post schedule 일정 추가하기
// TODO : coupleIdx, accountIdx는 islogin 미들웨어 넣어서 req.user에서 가져오도록 바꿔야함
router.post("/", checkPattern(scheduleReq, "content"), checkPattern(timestampReq, "date"), async(req,res,next) => {
    // const { coupleIdx, accountIdx } = req.user; // isLogin에서 token해석해서 전달
    const { coupleIdx } = req.body; // test용
    const { accountIdx } = req.body; // test용
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

// 4. put feed/:idx 특정 일정 수정하기
// TODO : coupleIdx는 islogin 미들웨어 넣어서 req.user에서 가져오도록 바꿔야함
// TODO : isMycouple 미들웨어 / 모듈 문제점 ==> 근데 이 다음에 test한 feed 에서는 또 잘됨 => why?
router.put("/:idx", checkPattern(scheduleReq, "content"), checkPattern(timestampReq, "date"), async(req, res, next) => {
    // const { coupleIdx } = req.user;
    const { coupleIdx } = req.body; // test용
    const { content, date } = req.body;
    const scheduleIdx = req.params.idx; // 일정의 idx

    const result = {
        success : false,
        message : ''
    };

    try{
        await isMycouple(coupleIdx, scheduleIdx, "schedule");

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
// TODO : coupleIdx는 islogin 미들웨어 넣어서 req.user에서 가져오도록 바꿔야함
// TODO : isMycouple 미들웨어 / 모듈 문제점
router.delete("/:idx", async(req, res, next) => {
    // const { coupleIdx }  = req.user;
    const { coupleIdx } = req.body; // test용
    const scheduleIdx = req.params.idx;

    const result = {
        success : false,
        message : '',
    };

    try{
        await isMycouple(coupleIdx, scheduleIdx, "schedule");

        // const sql = "UPDATE schedule SET is_delete = true WHERE idx = $1 AND couple_idx = $2"
        const sql = "DELETE FROM schedule WHERE idx = $1 AND couple_idx = $2"
        const values = [scheduleIdx, coupleIdx]
        await executeSQL(conn, sql, values)

        // 일정 soft delete 성공시
        result.success = true;
        result.message = `idx가 ${scheduleIdx}인 feed soft delete 성공`
    }catch(e){
        next(e);
    }
})

module.exports = router