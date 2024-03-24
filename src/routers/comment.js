const router = require("express").Router()
const jwt = require("jsonwebtoken")
const checkPattern = require("../middleware/checkPattern");
const isBlank = require("../middleware/isBlank");
const isLogin = require("../middleware/isLogin");
const { idReq,pwReq,nameReq,nicknameReq,imageReq,telReq,dateReq,commentReq } = require("../config/patterns");

const conn = require("../config/postgresql")

// 1. get comment 특정 피드의 전체 댓글 불러오기
router.get("/", isLogin, isBlank("feedIdx"), async(req, rex, next) => {
    const { coupleIdx } = req.user;
    // 피드 idx body로 받음
    const feedIdx = req.body;

    const result = {
        success : false,
        message : "",
        data : null
    }

    try{
        // 댓글 전체 오래된순으로 가져오기
        const sql = "SELECT * FROM comment WHERE feed_idx = $1 AND couple_idx = $2 AND is_delete = false ORDER BY create_at ASC";
        const values = [feedIdx, coupleIdx];

        const dbResult = await executeSQL(conn, sql, values);
        
        // 댓글 가져오기 실패시
        if (!dbResult || dbResult.length == 0) {
            // 1. 해당 피드가 존재하고 내 커플꺼도 맞는데 진짜 댓글이 없을 경우 (no error. 정상적으로 보내는 대신 message 남기기)
            // 2. 해당 피드가 존재하지 않을 경우 (404)
            // 3. 해당 피드가 존재하는데 접근 권한이 없을 경우 (403)
            result.message = `${feedIdx}번째에 해당하는 피드에 댓글이 없거나 접근 권한이 없거나 해당 피드가 존재하지 않습니다`;
        }

        // 댓글 가져오기 성공시
        result.success = true;
        result.data = dbResult;
        result.message = `idx가 ${feedIdx}인 피드의 전체 댓글 가져오기 성공`;
        res.status(200).send(result);
        
    }catch(e){
        next(e)
    }
})

// 2. post comment 특정 피드에 댓글 작성하기
router.post("/", isLogin, isBlank("feedIdx"), checkPattern(commentReq, "content"), async(req,res,next) => {
    const { accountIdx } = req.user; // isLogin에서 token 해석
    const { content , feedIdx } = req.body;

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `INSERT INTO comment (feed_idx, account_idx, comment)
                     VALUES ($1, $2, $3)`;
        const values = [feedIdx, accountIdx, content];

        await executeSQL(conn, sql, values);

        // 댓글 작성 성공시
        result.success = true;
        result.message = "댓글 작성 성공"
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 3. put comment/:idx 특정 댓글 수정하기
router.put("/:idx", isLogin, checkPattern(commentReq,"content"), isBlank("commentIdx"), async(req, res, next) => {
    const { coupleIdx } = req.user; //--> isLogin에서 준거
    const { content } = req.body;
    const { commentIdx } = req.params.idx;

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `UPDATE comment SET content = $1 WHERE idx = $2 AND couple_idx = $3`;
        const values = [content, commentIdx, coupleIdx];
        
        await executeSQL(conn, sql, values);

        // 수정 성공시
        result.success = true;
        result.message = `idx가 ${commentIdx}인 댓글 수정 성공`;
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 4. delete comment/:idx 특정 댓글 삭제하기 (hard delete)
router.delete("/:idx", isLogin, isBlank("commentIdx"), async(req, res, next) => {
    const { coupleIdx } = req.user;
    const commentIdx = req.params.idx;

    const result = {
        success : false,
        message : '',
    };

    try{
        // const sql = "UPDATE comment SET is_delete = true WHERE idx = $1 AND couple_idx = $2"
        const sql = "DELETE FROM comment WHERE idx=$1 AND couple_idx = $2"
        const values = [commentIdx, coupleIdx]

        await executeSQL(conn, sql, values)

        // 댓글 soft delete 성공시
        result.success = true;
        result.message = `idx가 ${commentIdx}인 comment soft delete 성공`
    }catch(e){
        next(e);
    }
})

module.exports = router