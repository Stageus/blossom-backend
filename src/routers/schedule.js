const router = require("express").Router()
const jwt = require("jsonwebtoken")
const redis = require("redis").createClient()
const checkPattern = require("../middleware/checkPattern");
const isBlank = require("../middleware/isBlank")
const { idReq,pwReq,nameReq,nicknameReq,imageReq,telReq,dateReq }= require("../config/patterns");

const conn = require("../config/postgresql")

// date : 년월일(date) 인경우도 있고 년월일시분초(timestamp) 인 경우도 있는데 둘다 이름이 date -> 헷갈리지 않을까
// dateReq : yyyymmdd 형식이라 timestamp 형도 만들어야할듯?

// 1.get schedule/all 특정 월의 전체 일정 불러오기
router.get("all", isLogin, isBlank("year", "month"), async(req, rex, next) => {
    const coupleIdx = req.user.couplpeIdx;
    const { year, month } = req.body; // 년, 월
    
    const result = {
        success : false,
        message : "",
        data : null
    }

    try{
        // date월의 일정 전체 최신순으로 가져오기
        const sql = `SELECT *
                     FROM schedule
                     WHERE is_delete = false AND couple_idx = $1 AND EXTRACT(YEAR FROM date) = $2 AND EXTRACT(MONTH FROM date) = $3
                     ORDER BY date ASC`;
        const values = [coupleIdx, year, month];

        const dbResult = await executeSQL(conn, sql, values);
    
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
router.get("/", isLogin, checkPattern(dateReq, "date"), async(req, res, next) => {
    const { date } = req.body; // 년, 월, 일
    const { coupleIdx } = req.user;

    const result = {
        success : false,
        message : '',
        data : null 
    };

    try{
        const sql = "SELECT * FROM schedule WHERE date = $1 AND couple_idx = $2 AND is_delete = false"
        const values = [date, coupleIdx];
        const dbResult = await executeSQL(conn, sql, values);

        //실패시
        if (!dbResult || dbResult.length == 0) {
            result.message = `${date} 날짜에 해당하는 일정이 없습니다.`
            // 404 안보내고 그냥 빈 list로 보내겠다
        }

        //성공시
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
router.post("/", isLogin, isBlank("content"), checkPattern(dateReq, "date"), async(req,res,next) => {
    const {content, date} = req.body; // timestamp형 date
    const {coupleIdx, accountIdx} = req.user // isLogin에서 token해석해서 전달

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
router.put("/:idx", isLogin, isBlank("content", "scheduleIdx"), checkPattern(dateReq, "date"), async(req, res, next) => {
    const {content, date} = req.body; // date = 년월일시분(timestamp)
    const scheduleIdx = req.params.idx;
    const { coupleIdx } = req.user;

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `UPDATE schedule SET content = $1, date = $2 WHERE idx = $3 AND couple_idx = $4`
        const values = [content, date, scheduleIdx, coupleIdx]
        
        await executeSQL(conn, sql, values)

        // 수정 성공시
        result.success = true;
        result.message = `idx가 ${scheduleIdx}인 일정 수정 성공`
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 5.delete schedule/:idx 특정 일정 삭제하기
router.delete("/:idx", isLogin, isBlank("scheduleIdx"), async(req, res, next) => {
    const scheduleIdx = req.params.idx;
    const coupleIdx = req.user;

    const result = {
        success : false,
        message : '',
    };

    try{
        const sql = "UPDATE schedule SET is_delete = true WHERE idx = $1 AND couple_idx = $2"
        const values = [scheduleIdx, coupleIdx]
        await executeSQL(conn, sql, values)

        // 일정 soft delete 성공시
        result.success = true;
        result.message = `idx가 ${feedIdx}인 feed soft delete 성공`
    }catch(e){
        next(e);
    }
})
