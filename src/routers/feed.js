const router = require("express").Router()
const jwt = require("jsonwebtoken")
const redis = require("redis").createClient()

const conn = require("../config/postgresql")

// 오류코드 추가, 미들웨어추가(정규식확인)
// 피드 이미지 올리는거 모듈화? 미들웨어말고
// const { couple_idx } = req.decode; --> isLogin에서 토큰 확인후 couple_idx와 account_idx 줘야함


// 1. get feed/all 피드 전체 불러오기
router.get("all", isLogin, async(req, rex, next) => {
    const result = {
        success : false,
        message : "",
        data : null
    }

    try{
        // 피드 전체 최신순으로 가져오기
        const sql = "SELECT * FROM feed WHERE is_delete = false ORDER BY create_at DESC";
        const values = [];

        const dbResult = await executeSQL(conn, sql, values)
    
        // 성공시
        result.success = true;
        result.data = dbResult;
        result.message = "모든 피드 가져오기 성공"
        res.status(200).send(result);
        
    }catch(e){
        next(e)
    }
})

// 2. get feed/search 날짜로 검색한 피드 불러오기
router.get("/search", isLogin, async(req, res, next) => {
    const { date } = req.body;

    const result = {
        success : false,
        message : '',
        data : null 
    };

    try{
        const sql = "SELECT * FROM feed WHERE date = $1 AND is_delete = false ORDER BY create_at DESC"
        const values = [date];
        const dbResult = await executeSQL(conn, sql, values);

        if (!dbResult || dbResult.length == 0) {
            result.message = `${date} 날짜에 해당하는 피드가 없습니다.`
        }
        else{
            result.message = `${date} 날짜에 해당하는 피드 가져오기 성공`
        }
        result.success = true;
        result.data = dbResult;
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 3. post feed 피드 작성하기
router.post("/", isLogin, async(req,res,next) => {
    // date = 년,월,일 type
    const {content, date, image} = req.body; // image 올리는거 수정필요 (s3 미들웨어 -> 모듈화)
    const {coupleIdx, accountIdx} = req.decode; // isLogin에서 token해석해서 전달

    const result = {
        success : false,
        message : ''
    };

    try{
        // 이미지가 있는 경우
        if(image){
            const sql = `INSERT INTO feed (couple_idx, account_idx, content, date, image_url)
                         VALUES ($1, $2, $3, $4, $5)`
            const values = [coupleIdx, accountIdx, content, date, image]

        }
        else{ // 이미지 없이 글만 있는 경우
            const sql = `INSERT INTO feed (couple_idx, account_idx, content, date)
                         VALUES ($1, $2, $3, $4)`;
            const values = [coupleIdx, accountIdx, content, date]
        }
        const dbResult = await executeSQL(conn, sql, values)

        // 피드 작성 오류일 경우

        // 피드 작성 성공시
        result.success = true;
        result.message = "피드 작성 성공"
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 4. put feed/:idx 특정 피드 수정하기
router.put("/:idx", isLogin, async(req, res, next) => {
    const {content, newPic, delPic} = req.body; //newPic은 이미지 처리 필요. delPic은 db에 저장된 url string 형태일것.
    const feedIdx = req.params.idx;
    const { coupleIdx } = req.decode; //--> isLogin에서 토큰 확인후 couple_idx와 account_idx 줘야함

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `UPDATE feed SET content = $1, image_url = $2 WHERE idx = $3 AND couple_idx = $4`
        const values = [content, newPic, feedIdx, coupleIdx]
        
        const dbResult = await executeSQL(conn, sql, values)

        // 수정 성공시
        result.success = true;
        result.message = `idx가 ${feedIdx}인 피드 수정 성공`
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 5. delete feed/:idx 특정 피드 삭제하기
router.delete("/:idx", isLogin,  async(req, res, next) => {
    const feedIdx = req.params.idx;
    const coupleIdx = req.decode;

    const result = {
        success : false,
        message : '',
    };

    try{
        const sql = "UPDATE feed SET is_delete = true WHERE idx = $1 AND couple_idx = $2"
        const values = [feedIdx, coupleIdx]
        const dbResult = await executeSQL(conn, sql, values)

        result.success = true;
        result.message = `idx가 ${feedIdx}인 feed soft delete 성공`
    }catch(e){
        next(e);
    }
})
