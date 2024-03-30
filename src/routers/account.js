const router = require("express").Router()
const jwt = require('jsonwebtoken');
const conn = require("../config/postgresql");
const checkPattern = require("../middleware/checkPattern");
const generateToken = require("../modules/generateToken");
const logRequest = require('../middleware/logger');
const { idReq,pwReq,nameReq,telReq,dateReq }= require("../config/patterns");

// 로그인 API
router.post('/login', checkPattern(idReq, 'id'), checkPattern(pwReq, 'pw'), logRequest, async (req, res, next) => {
    const { id, pw } = req.body;
    const result = {
        success: false,
        message: '로그인 실패',
        data: {
            token : ""
        }
    };

    try {

        const sql = "SELECT * FROM account WHERE id = $1 AND pw = $2";
        const values = [id, pw];

        const { rows } = await executeSQL(conn, sql, values);

        if (rows.length === 0) {
            result.message = "일치하는 정보 없음";
            return res.status(401).send(result);
        }
        const coupleSql = `SELECT idx FROM couple WHERE couple1_idx = $1 OR couple2_idx = $1;`;
        const coupleValues = [rows.idx];

        const queryResult = await executeSQL(conn, coupleSql, coupleValues);
        const coupleIdx = queryResult.rows[0].idx;

        if (coupleIdx == null || undefined || 0){
            return next({
                message : "커플 연결 되어있지 않음, 커플 연결 해야함",
                status : 404
            });
        }

        // 토큰 발급
        const token = await generateToken(rows[0], coupleIdx);

        result.success = true;
        result.message = '로그인 성공';
        result.data.user = rows[0];
        result.data.token = token;

        res.send(result);

    } catch (error) {
        console.error('로그인 오류: ', error);
        result.message = '로그인 오류 발생';
        result.error = error;
        return res.status(500).send(result);

    }
});

// 회원가입 API
router.post("signup", checkPattern(nameReq,'name'), checkPattern(idReq,'id'), checkPattern(pwReq, 'pw'), checkPattern(dateReq, 'birth'),checkPattern(telReq,'tel'), logRequest, async (req, res, next) => {
    const { id, pw, name, tel, birth } = req.body;
    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const sql =`SELECT * FROM account WHERE id = $1`;
        const values = [id];

        const { rows } = await executeSQL(conn, sql, values);

        if (rows.length > 0) {
            return next({
                message : "이미 사용 중",
                status : 409
            });   
        } else {
            const insertQuery = `INSERT INTO account (name, id, pw, tel, birth) VALUES ($1, $2, $3, $4, $5);`;
            const values = [name, id, pw, tel, birth];
    
            const { rowCount } = await executeSQL(conn, insertQuery, values);

            if (rowCount == 0) {
                return next({
                    message : "회원 가입 오류",
                    status : 500
                });
            }  

            result.success = true;
            result.data = rowCount;
            result.message = "회원 가입 성공"
        }

        res.send(result);

    }
    catch(e){
        next();
    }
});

// id 찾기 API -> 이름, 전화번호
router.get("/find/id", checkPattern(nameReq,'name'), checkPattern( telReq,'tel'), logRequest, async (req, res, next) => {
    const { name, tel } = req.body;
    const result = {
        success: false,
        message: "아이디 찾기 실패",
        data: null
    };

    try {

        const sql = `SELECT id FROM account WHERE name = $1 AND tel = $2;`;
        const values = [name, tel];

        const { rows } = await executeSQL(conn, sql, values);

        if (rows.length == 0) {
            return next({
                message : "일치하는 정보 없음",
                status : 404
            });  
        }

        const foundId = rows[0].id;
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
router.get("/find/pw", checkPattern(nameReq,'name'), checkPattern( telReq,'tel'), checkPattern(idReq,'id'), logRequest, async (req,res,next) => {
    const { name, tel, id} = req.body
    const result = {
        "success" : false, 
        "message" : "",
        "data" : null 
    }

    try{

        const sql = `SELECT pw FROM account WHERE name = $1 AND tel = $2 AND id = $3`;
        const values = [name, tel, id];

        const { rows } = await executeSQL(conn, sql, values);

        if (rows.length === 0) {
            return next({
                message : "일치하는 정보 없음",
                status : 404
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
router.put("/pw", checkPattern(pwReq,'pw'), checkPattern(pwReq,'newPw'), checkPattern(pwReq,'newPwCheck'), logRequest, async (req,res,next) => {
    const { userIdx, pw, newPw, newPwCheck } = req.body; 
    const result = {
        "success" : false, 
        "message" : "",
        "data" : null 
    }

    try{
        
        if(newPw!=newPwCheck){
            return next({
                message : "비밀번호 일치하지 않음",
                status : 401
            });  
        }

        const changePwQuery = {
            text: `UPDATE account SET pw = $1, WHERE idx = $2;`,
            values: [pw, userIdx],
        };

        const { rowCount } = await queryConnect(changePwQuery);

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