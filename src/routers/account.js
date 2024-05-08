const router = require("express").Router()
const jwt = require('jsonwebtoken');
const conn = require("../config/postgresql");
const checkPattern = require("../middleware/checkPattern");
const generateToken = require("../modules/generateToken");
const { idReq, pwReq, nameReq, telReq, dateReq } = require("../config/patterns");
const { executeSQL } = require("../modules/sql");
const { loggingMiddleware } = require("../config/mongodb")

router.use(loggingMiddleware);

// 로그인 API
router.post('/login', checkPattern(idReq, 'id'), checkPattern(pwReq, 'pw'), async (req, res, next) => {
    const { id, pw } = req.body;
    const result = {
        success: false,
        message: '로그인 실패',
        data: {
            token: ""
        }
    };

    try {

        const sql = "SELECT * FROM account WHERE id = $1 AND pw = $2";
        const values = [id, pw];

        const dbResult = await executeSQL(conn, sql, values);

        if (dbResult.length === 0) {
            result.message = "일치하는 정보 없음";
            return res.status(401).send(result);
        }

        result.message = '로그인 성공';

        const coupleSql = `SELECT idx FROM couple WHERE couple1_idx = $1 OR couple2_idx = $1;`;
        const coupleValues = [dbResult.idx];

        const queryResult = await executeSQL(conn, coupleSql, coupleValues);
        console.log(queryResult);
        let coupleIdx = 0;
        if (queryResult.length > 0) {
            coupleIdx = queryResult[0].idx;
        } else {
            result.message = "커플 연결 되어있지 않음, 커플 연결 해야함";
            //coupleIdx 관련 문제
        }

        // 토큰 발급
        const token = await generateToken(dbResult[0], coupleIdx);

        result.success = true;

        result.data.user = dbResult[0];
        result.data.token = token;

        res.send(result);

    } catch (error) {
        console.error('로그인 오류: ', error);
        result.message = '로그인 오류 발생';
        result.error = error;
        return res.status(500).send(result);

    }
});

// id 중복확인 api
router.get("/checkId", checkPattern(idReq, 'id'), async (req, res, next) => {
    const { id } = req.body;
    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const sql = `SELECT * FROM account WHERE id = $1`;
        const values = [id];

        const dbResult = await executeSQL(conn, sql, values);

        if (dbResult.length > 0) {
            return next({
                message: "이미 사용 중",
                status: 409
            });

        } else {
            result.success = true;
            result.data = rowCount;
            result.message = "아이디 사용 가능"
        }

        res.send(result);

    }
    catch (e) {
        next();
    }
});

// 회원가입 API
router.post("/signup", checkPattern(nameReq, 'name'), checkPattern(idReq, 'id'), checkPattern(pwReq, 'pw'), checkPattern(dateReq, 'birth'), checkPattern(telReq, 'tel'), async (req, res, next) => {
    const { id, pw, name, tel, birth } = req.body;
    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const insertQuery = `INSERT INTO account (name, id, pw, tel, birth) VALUES ($1, $2, $3, $4, $5);`;
        const values = [name, id, pw, tel, birth];

        const insertResult = await executeSQL(conn, insertQuery, values);
        const rowCount = insertResult.rowCount;

        if (rowCount == 0) {
            return next({
                message: "회원 가입 오류",
                status: 500
            });
        }

        result.success = true;
        result.data = rowCount;
        result.message = "회원 가입 성공"


        res.send(result);

    }
    catch (e) {
        next();
    }
});

// id 찾기 API -> 이름, 전화번호
router.get("/find/id", checkPattern(nameReq, 'name'), checkPattern(telReq, 'tel'), async (req, res, next) => {
    const { name, tel } = req.body;
    const result = {
        success: false,
        message: "아이디 찾기 실패",
        data: null
    };

    try {

        const sql = `SELECT id FROM account WHERE name = $1 AND tel = $2;`;
        const values = [name, tel];

        const dbResult = await executeSQL(conn, sql, values);

        if (dbResult.length == 0) {
            return next({
                message: "일치하는 정보 없음",
                status: 404
            });
        }

        const foundId = dbResult[0].id;
        result.success = true;
        result.message = `아이디 찾기 성공, 아이디는 ${foundId} 입니다.`;
        result.data = { id: foundId };

        res.send(result);

    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// pw 확인 부분
router.get("/find/pw", checkPattern(nameReq, 'name'), checkPattern(telReq, 'tel'), checkPattern(idReq, 'id'), async (req, res, next) => {
    const { name, tel, id } = req.body
    const result = {
        "success": false,
        "message": "",
        "data": null
    }

    try {

        const sql = `SELECT pw FROM account WHERE name = $1 AND tel = $2 AND id = $3`;
        const values = [name, tel, id];

        const dbResult = await executeSQL(conn, sql, values);

        if (dbResult.length === 0) {
            return next({
                message: "일치하는 정보 없음",
                status: 404
            });
        }

        result.success = true;
        result.message = "비밀번호 조회 성공";

        res.send(result);

    } catch (error) {
        result.message = error.message;
        return next(error);
    }
});

// pw 변경 부분
router.put("/pw", checkPattern(pwReq, 'pw'), checkPattern(pwReq, 'newPw'), checkPattern(pwReq, 'newPwCheck'), async (req, res, next) => {
    const { userIdx, pw, newPw, newPwCheck } = req.body;
    const result = {
        "success": false,
        "message": "",
        "data": null
    }

    try {

        if (newPw != newPwCheck) {
            return next({
                message: "비밀번호 일치하지 않음",
                status: 401
            });
        }

        const sql = `UPDATE account SET pw = $1 WHERE idx = $2`;
        const values = [newPw, userIdx];

        const dbResult = await executeSQL(conn, sql, values);
        const rowCount = dbResult.rowCount;

        if (rowCount === 0) {
            throw new Error("비밀번호 변경 실패");
        }

        result.success = true;
        result.message = "비밀번호 변경 성공";

        res.send(result);

    } catch (error) {
        result.message = error.message;
        return next(error);
    }
});

module.exports = router;