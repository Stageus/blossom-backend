const router = require("express").Router()
const jwt = require("jsonwebtoken")
const redis = require("redis").createClient()

const conn = require("../config/postgresql")

// 1. get comment 특정 피드의 전체 댓글 불러오기
router.get("/", isLogin, async(req, rex, next) => {
    // 피드 idx body로 받음
    const feedIdx = req.body;

    const result = {
        success : false,
        message : "",
        data : null
    }

    try{
        // 댓글 전체 오래된순으로 가져오기
        const sql = "SELECT * FROM comment WHERE feed_idx = $1 AND is_delete = false ORDER BY create_at ASC";
        const values = [feedIdx];

        const dbResult = await executeSQL(conn, sql, values)
        // 실패시

        // 성공시
        result.success = true;
        result.data = dbResult;
        result.message = `idx가 ${feedIdx}인 피드의 전체 댓글 가져오기 성공`
        res.status(200).send(result);
        
    }catch(e){
        next(e)
    }
})

// 2. post comment 특정 피드에 댓글 작성하기
router.post("/", isLogin, async(req,res,next) => {
    // date = 년,월,일 type
    const {content, feedIdx} = req.body; // image 올리는거 수정필요 (s3 미들웨어 -> 모듈화)
    const { accountIdx } = req.decode // isLogin에서 token 해석해서 가져와야함

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `INSERT INTO comment (feed_idx, account_idx, comment)
                     VALUES ($1, $2, $3)`
        const values = [feedIdx, accountIdx, content]

        const dbResult = await executeSQL(conn, sql, values)

        // 댓글 작성 오류일 경우

        // 댓글 작성 성공시
        result.success = true;
        result.message = "댓글 작성 성공"
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 3. put comment/:idx 특정 댓글 수정하기
router.put("/:idx", isLogin, async(req, res, next) => {
    const {content} = req.body; //newPic은 이미지 처리 필요. delPic은 db에 저장된 url string 형태일것.
    const { coupleIdx } = req.decode; //--> isLogin에서 토큰 확인후 couple_idx와 account_idx 줘야함
    const { commentIdx } = req.params.idx;

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `UPDATE comment SET content = $1 WHERE idx = $2 AND couple_idx = $3`
        const values = [content, commentIdx, coupleIdx]
        
        const dbResult = await executeSQL(conn, sql, values)

        // 수정 성공시
        result.success = true;
        result.message = `idx가 ${commentIdx}인 댓글 수정 성공`
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 4. delete comment/:idx 특정 댓글 삭제하기
router.delete("/:idx", isLogin,  async(req, res, next) => {
    const commentIdx = req.params.idx;
    const coupleIdx = req.decode;

    const result = {
        success : false,
        message : '',
    };

    try{
        const sql = "UPDATE comment SET is_delete = true WHERE idx = $1 AND couple_idx = $2"
        const values = [commentIdx, coupleIdx]
        const dbResult = await executeSQL(conn, sql, values)
        //실패시

        //성공시
        result.success = true;
        result.message = `idx가 ${commentIdx}인 comment soft delete 성공`
    }catch(e){
        next(e);
    }
})