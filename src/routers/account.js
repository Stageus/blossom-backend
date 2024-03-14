const router = require("express").Router()
const jwt = require('jsonwebtoken');
const conn = require("../config/postgresql");
const checkPattern = require("../middleware/checkPattern");
const makeLog = require("../modules/makelog");
const redis = require("redis").createClient();
const uuid = require("uuid")
const { idReq,pwReq,nameReq,telReq,dateReq }= require("../config/patterns");

// 로그인 API -> token 방식 대신 uuid 사용?
router.post('/account/login', checkPattern(idReq, 'id'), checkPattern(pwReq, 'pw'), async (req, res, next) => {
    const { id, pw } = req.body;
    const result = {
        success: false,
        message: '로그인 실패',
        data: null
    };

    try {

        const sql = "SELECT * FROM account WHERE id = $1 AND pw = $2";
        const values = [id, pw];

        const { rows } = await executeSQL(conn, sql, values);

        if (rows.length === 0) {
            result.message = "일치하는 정보 없음";
            return res.status(401).send(result);
        }

        const coupleQuery = {
            text: 'SELECT idx FROM couple WHERE couple1_idx = $1 OR couple2_idx = $1',
            values: [rows.idx],
        };

        const queryResult = await queryConnect(coupleQuery);
        const coupleIdx = queryResult.rows[0].idx;

        //커플 연결 유무 확인 -> 미들웨어로 뺄지말지?
        if (coupleIdx == null || undefined || 0){
            return next({
                message : "커플 연결 되어있지 않음, 커플 연결 해야함",
                status : 401
            });
        }

        //빼야하나용??
        const token = jwt.sign(
            {
                id: rows[0].id,
                idx: rows[0].idx,
                coupleIdx : coupleIdx,
                isadmin: rows[0].isadmin,
                uuid: uniqueId
            },
            process.env.SECRET_KEY,
            {
                issuer: rows[0].id,
                expiresIn: '10m'
            }
        );

        result.success = true;
        result.message = '로그인 성공';
        result.data.user = rows[0];
        result.data.token = token;

        res.cookie("token", token, { httpOnly: true, secure: false });
        res.send(result);

        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/account/login',
            restMethod: 'post',
            inputData: { id, pw },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);

    } catch (error) {
        console.error('로그인 오류: ', error);
        result.message = '로그인 오류 발생';
        result.error = error;
        return res.status(500).send(result);

    } finally {
        await redis.disconnect();
    }
});

// id 찾기 API -> 이름, 전화번호
router.get("/account/find/id", checkPattern(nameReq,'name'), checkPattern( telReq,'tel'),async (req, res, next) => {
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
                status : 401
            });  
        }

        const foundId = rows[0].id;
        result.success = true;
        result.message = `아이디 찾기 성공, 아이디는 ${foundId} 입니다.`;
        result.data = { id: foundId };

        res.send(result);

        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/account/find/id',
            restMethod: 'get',
            inputData: { name,tel },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);

    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// pw 찾기 API -> api 명세서랑 다름.. api 명세서는 pw찾기 / pw 변경 따로따로임!
router.get("/account/find/pw",  checkPattern(nameReq,'name'), checkPattern( telReq,'tel'), checkPattern(idReq,'id'), checkPattern(pwReq,'pw'), async (req,res,next) => {
    const { name, tel, id , pw} = req.body
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
                status : 401
            });                
        }

        const userIdx = rows.idx;
       
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

        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/account/find/pw',
            restMethod: 'get',
            inputData: { name, tel, id, pw},
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);

    } catch (error) {
        result.message = error.message;
        return next(error);
    }
});

// 회원가입 API
router.post("/account/signup", checkPattern(nameReq,'name'), checkPattern(idReq,'id'), checkPattern(pwReq, 'pw'), checkPattern(dateReq, 'birth'),checkPattern(telReq,'tel'), async (req, res, next) => {
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

        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/account/signup',
            restMethod: 'post',
            inputData: { id, pw, name, tel, birth },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);

    }
    catch(e){
        next();
    }
});

module.exports = router