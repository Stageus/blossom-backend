const router = require("express").Router()
const jwt = require('jsonwebtoken');
//const queryConnect = require('../modules/queryConnect');
const checkPattern = require("../middleware/checkPattern");
const redis = require("redis").createClient();
const uuid = require("uuid")
const { idReq,pwReq,nameReq,nicknameReq,imageReq,telReq,dateReq }= require("../config/patterns");

// 로그인 API -> token 방식 대신 uuid 사용?
router.post('/login', checkPattern(idReq, 'id'), checkPattern(pwReq, 'pw'), async (req, res, next) => {
    const { id, pw } = req.body;
    const result = {
        success: false,
        message: '로그인 실패',
        data: null
    };

    try {
        const query = {
            text: 'SELECT * FROM account WHERE id = $1 AND pw = $2',
            values: [id, pw],
        };

        const { rows } = await queryConnect(query);

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

    } catch (error) {
        console.error('로그인 오류: ', error);
        result.message = '로그인 오류 발생';
        result.error = error;
        return res.status(500).send(result);

    } finally {
        await redis.disconnect();
    }
});

// 로그아웃 API
router.post('/logout', isLogin, async (req, res, next) => {
    const result = {
        success: false,
        message: '로그아웃 실패',
        data: null
    };

    try {
        result.success = true;
        result.message = '로그아웃 성공';
        res.status(200).json(result);
    } catch (error) {
        next(error);
    } finally {
        await redis.disconnect();
    }
});

// id 찾기 API -> 이름, 전화번호
router.get("/findid", checkPattern(nameReq,'name'), checkPattern( telReq,'tel'),async (req, res, next) => {
    const { name, tel } = req.body;
    const result = {
        success: false,
        message: "아이디 찾기 실패",
        data: null
    };

    try {
        const query = {
            text: `SELECT id FROM account WHERE name = $1 AND tel = $2;`,
            values: [name, tel],
        };

        const { rows } = await queryConnect(query);

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

    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// pw 찾기 API
router.get("/findpw",  checkPattern(nameReq,'name'), checkPattern( telReq,'tel'), checkPattern(idReq,'id'), checkPattern(pwReq,'pw'), async (req,res,next) => {
    const { name, tel, id , pw} = req.body
    const result = {
        "success" : false, 
        "message" : "",
        "data" : null 
    }

    try{
        const query = {
            text: `SELECT pw FROM account WHERE name = $1 AND tel = $2 AND id = $3`,
            values: [name, tel, id],
        };

        const { rows } = await queryConnect(query);

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
        //result.data = {  }; // 빼기?? -> 굳이 뭘 줘야하는게 없음
        result.message = "비밀번호 변경 성공";

        res.send(result);

    } catch (error) {
        result.message = error.message;
        return next(error);
    }
});

// 회원가입 API
router.post("/", checkPattern(nameReq,'name'), checkPattern(idReq,'id'), checkPattern(pwReq, 'pw'), checkPattern(dateReq, 'birth'),checkPattern(telReq,'tel'), async (req, res, next) => {
    const { id, pw, name, tel, birth } = req.body;
    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const selectQuery = {
            text: `SELECT * FROM account WHERE id = $1`,
            values: [id],
        };
        const { rows } = await queryConnect(selectQuery);

        if (rows.length > 0) {
            return next({
                message : "이미 사용 중",
                status : 409
            });   
        } else {
            const insertQuery = {
                text: `INSERT INTO account (name,id,pw,tel,birth) VALUES ($1, $2, $3, $4, $5);`,
                values: [name, id, pw, tel, birth],
            };
            const { rowCount } = await queryConnect(insertQuery);

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

        res.send(result)  

    }
    catch(e){
        next();
    }
});

module.exports = router