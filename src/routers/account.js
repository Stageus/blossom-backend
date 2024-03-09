const router = require("express").Router()
const jwt = require('jsonwebtoken');
//const queryConnect = require('../modules/queryConnect');
const checkPattern = require("../middleware/checkPattern");
const redis = require("redis").createClient();
const uuid = require("uuid")
const { idReq, pwReq, emailReq, nameReq, genderReq, dateReq, addressReq, telReq }= require("../config/patterns");

// 로그인 API
router.post('/login', checkPattern(idReq, 'id'), checkPattern(pwReq, 'pw'), async (req, res, next) => {
    const { id, pw } = req.body;
    const result = {
        success: false,
        message: '로그인 실패',
        data: {
            token: "",
            user: null,
            dailyLogin: null,
            totalLogin: null
        }
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
      
        await redis.connect();

        const prevUniqueId = await redis.get(`user:${rows[0].id}`);
        console.log("prevUniqueId: ",prevUniqueId)
        if (prevUniqueId) {
            console.log("중복로그인임.");
            await redis.DEL(`user:${rows[0].id}`);
            console.log("기존 uid 삭제.");
        }

        const uniqueId = uuid.v4();
        console.log("새로운 uid 생성");

        await redis.set(`user:${rows[0].id}`, uniqueId);
        console.log("uniqueId: ",uniqueId)
        await redis.EXPIRE(`user:${rows[0].id}`, 600000); // 10분 유효

        const token = jwt.sign(
            {
                id: rows[0].id,
                idx: rows[0].idx,
                //couple_idx : rows[0].couple_idx, -> couple 테이블에서 조회??
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
    const userId = req.user.id;
    const result = {
        success: false,
        message: '로그아웃 실패',
        data: null
    };
    // Redis에서 사용자 ID 제거
    await redis.connect();
    
    const prevUniqueId = await redis.get(`user:${userId}`);
    console.log("prevUniqueId: ",prevUniqueId)
    
    await redis.DEL(`user:${userId}`);

    try {
        res.clearCookie("token");
        result.success = true;
        result.message = '로그아웃 성공';
        res.status(200).json(result);
    } catch (error) {
        next(error);
    } finally {
        await redis.disconnect();
    }
});

// id 찾기 API
router.get("/findid", checkPattern(nameReq,'name'), checkPattern( emailReq,'email'),async (req, res, next) => {
    const { name, email } = req.body;
    const result = {
        success: false,
        message: "아이디 찾기 실패",
        data: null
    };

    try {
        const query = {
            text: `
                SELECT 
                    id 
                FROM 
                    account 
                WHERE 
                    name = $1 
                    AND 
                    email = $2;
                    `,
            values: [name, email],
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
router.get("/findpw",  checkPattern(nameReq,'name'), checkPattern( emailReq,'email'), checkPattern(idReq,'id'), async (req,res,next) => {
    const { name, email, id } = req.body
    const result = {
        "success" : false, 
        "message" : "",
        "data" : null 
    }

    try{
        const query = {
            text: `
                SELECT 
                    pw 
                FROM 
                    account 
                WHERE 
                    name = $1 
                    AND 
                    email = $2 
                    AND 
                    id = $3
                `,
            values: [name, email, id],
        };

        const { rows } = await queryConnect(query);

        if (rows.length === 0) {
            return next({
                message : "일치하는 정보 없음",
                status : 401
            });                
        }
       
        const foundPw = rows[0].pw;
        result.success = true;
        result.message = `비밀번호 찾기 성공, 비밀번호는 ${foundPw} 입니다.`;
        result.data = { pw: foundPw };
  
        res.send(result);

    } catch (error) {
        result.message = error.message;
    }
});

// 회원가입 API
router.post("/", checkPattern(nameReq,'name'), checkPattern( emailReq,'email'), checkPattern(idReq,'id'), checkPattern(pwReq, 'pw'), checkPattern(genderReq,'gender'), checkPattern(birthReq, 'birth'),checkPattern(telReq,'tel'), checkPattern(addressReq, 'address'), async (req, res, next) => {
    const { id, pw, name, email, tel, birth, address, gender } = req.body;
    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const selectQuery = {
            text: `
                    SELECT 
                        * 
                    FROM 
                        account 
                    WHERE 
                        id = $1 
                        OR 
                        email = $2
                    `,
            values: [id, email],
        };
        const { rows } = await queryConnect(selectQuery);

        if (rows.length > 0) {
            return next({
                message : "이미 사용 중",
                status : 409
            });   
        } else {
            const insertQuery = {
                text: `
                        INSERT INTO 
                            account (
                                name,
                                id,
                                pw,
                                tel,
                                gender
                        ) VALUES (
                            $1, $2, $3, $4, $5
                        );
                    `,
                values: [name, id, pw, tel, gender],
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

// 비밀번호 변경 API
router.put("/my", isLogin, checkPattern(pwReq, 'pw'), checkPattern(genderReq,'gender'), checkPattern(birthReq, 'birth'),checkPattern(telReq,'tel'), checkPattern(addressReq, 'address'), async (req, res, next) => {
    const { pw } = req.body;
    const userIdx = req.user.idx; 
    const userId = req.user.id; 

    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const query = {
            text: `
                    UPDATE 
                        account
                    SET 
                        pw = $1,
                    WHERE 
                        idx = $6;
                    `,
            values: [pw, tel, gender, address, birth, userIdx],
        };

        const { rowCount } = await queryConnect(query);

        if (rowCount === 0) {
            throw new Error("비밀번호 변경 실패");
        }

        result.success = true;
        result.data = { pw, tel, gender, address, birth };
        result.message = "비밀번호 변경 성공";

        res.send(result);
    } catch (error) {
        result.message = error.message;
        next(error);
    }
});

module.exports = router