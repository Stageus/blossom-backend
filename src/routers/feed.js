const router = require("express").Router();
const jwt = require("jsonwebtoken");
const checkPattern = require("../middleware/checkPattern");
const isLogin = require("../middleware/isLogin");
const { idReq, pwReq, nameReq, nicknameReq, imageReq, telReq, dateReq, feedReq } = require("../config/patterns");
const { s3 } = require("../config/s3");
const { uploadImage } = require("../modules/uploadImage");
const { executeSQL } = require("../modules/sql");

const conn = require("../config/postgresql");

const { loggingMiddleware } = require("../config/mongodb")
router.use(loggingMiddleware);

// 1. get feed/all 피드 전체 불러오기
router.get("/all", isLogin, async (req, res, next) => {
    const { coupleIdx } = req.user;
    const { lastIdx } = req.body;

    const result = {
        success: false,
        message: "",
        data: null
    }

    try {
        // 피드 전체 최신순으로 가져오기
        const sql = `SELECT * FROM feed 
                    WHERE is_delete = false 
                    AND couple_idx = $1 
                    AND idx > $2 
                    ORDER BY create_at DESC 
                    LIMIT 10`;

        const values = [coupleIdx, lastIdx];

        const dbResult = await executeSQL(conn, sql, values);

        // 피드 전체 가져오기 성공시
        result.success = true;
        result.data = dbResult;
        result.message = "모든 피드 가져오기 성공";
        res.status(200).send(result);

    } catch (e) {
        next(e);
    }
})

// 2. get feed/search 날짜로 검색한 피드 불러오기
router.get("/search", isLogin, checkPattern(dateReq, "date"), async (req, res, next) => {
    const { coupleIdx } = req.user;
    const { date } = req.body; // YYYYMMDD 형식 (postgresql table의 date는 timestamp지만 비교가능)

    const result = {
        success: false,
        message: '',
        data: null
    };

    try {
        const sql = "SELECT * FROM feed WHERE date = $1 AND couple_idx = $2 AND is_delete = false ORDER BY create_at DESC"
        const values = [date, coupleIdx];
        const dbResult = await executeSQL(conn, sql, values);

        if (!dbResult || dbResult.length == 0) {
            result.message = `${date} 날짜에 해당하는 피드가 없거나 접근 권한이 없습니다`;
            // 404 안보내고 그냥 빈 list로 보내겠다
        }
        else {
            result.message = `${date} 날짜에 해당하는 피드 가져오기 성공`;
        }
        result.success = true;
        result.data = dbResult;
        res.status(200).send(result);

    } catch (e) {
        next(e);
    }
})

// 3. post feed 피드 작성하기
router.post("/", isLogin, uploadImage("image"), checkPattern(feedReq, "content"), checkPattern(dateReq, "date"), async (req, res, next) => {
    const { coupleIdx, idx } = req.user;
    const { content, date } = req.body;
    const image = req.file;

    const result = {
        success: false,
        message: ''
    };

    try {
        const sql = `INSERT INTO feed (couple_idx, account_idx, content, date, image_url)
                     VALUES ($1, $2, $3, $4, $5)`;
        const values = [coupleIdx, idx, content, date, image];

        await executeSQL(conn, sql, values);

        // 피드 작성 성공시
        result.success = true;
        result.message = "피드 작성 성공";
        res.status(200).send(result);

    } catch (e) {
        next(e);
    }
})

// 4. put feed/:idx 특정 피드 수정하기
router.put("/:idx", isLogin, uploadImage("image"), checkPattern(feedReq, "content"), async (req, res, next) => {
    const { coupleIdx } = req.user;
    const { content } = req.body;
    const image = req.file;
    const feedIdx = req.params.idx;

    const result = {
        success: false,
        message: ''
    };

    try {
        const sql = `UPDATE feed SET content = $1 AND image_url = $2 WHERE idx = $3 AND couple_idx = $4`
        const values = [content, feedIdx, coupleIdx]

        await executeSQL(conn, sql, values);

        // 수정 성공시
        result.success = true;
        result.message = `idx가 ${feedIdx}인 피드 수정 성공`;
        res.status(200).send(result);

    } catch (e) {
        next(e);
    }
})

// 5. delete feed/:idx 특정 피드 삭제하기
router.delete("/:idx", isLogin, async (req, res, next) => {
    const { coupleIdx } = req.user;
    const feedIdx = req.params.idx;

    const result = {
        success: false,
        message: '',
    };

    try {
        // const sql = "UPDATE feed SET is_delete = true WHERE idx = $1 AND couple_idx = $2";
        const sql = "DELETE FROM feed WHERE idx = $1 AND couple_idx = $2"
        const values = [feedIdx, coupleIdx];
        await executeSQL(conn, sql, values);

        // 피드 soft delete 성공시
        result.success = true;
        result.message = `idx가 ${feedIdx}인 feed soft delete 성공`;

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
})

module.exports = router
