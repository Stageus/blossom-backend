const router = require("express").Router()
const jwt = require('jsonwebtoken');
//const queryConnect = require('../modules/queryConnect');
const checkPattern = require("../middleware/checkPattern");
const redis = require("redis").createClient();
const { idReq, pwReq, emailReq, nameReq, genderReq, dateReq, addressReq, telReq }= require("../config/patterns");

//커플 미들웨어 생성 ??
//커플 테이블에서 조회한 후, 없으면 커플 초기연결을 해주세요 -> 설정페이지로 이동하게끔?
// 커플 테이블에서 조회한 후 결과 있으면 

// 커플 정보 불러오기 api
router.get('/couple/:idx', async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const result = {
        success: false,
        message: '커플 정보 불러오기 실패',
        data: {
            token: "",
            user: null,
            dailyLogin: null,
            totalLogin: null
        }
    };
    const query = {
        text: `
            SELECT 
                idx 
            FROM 
                couple 
            WHERE 
                idx = $1 
                AND 
                account_idx = $2;
                `,
        values: [coupleIdx, userIdx],
    };

    const { rows } = await queryConnect(query);

    if (rows.length == 0) {
        return next({
            message : "일치하는 정보 없음",
            status : 401
        });  
    }

    result.success = true;
    result.message = `커플 정보 불러오기 성공.`;
    result.data = { rows };

    res.send(result);

});

//커플 상대찾기 api
router.post('/couple', checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const userIdx = req.user.idx
    const { couplePartnerId } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 등록 실패',
        data: {
            token: "",
            user: null,
            dailyLogin: null,
            totalLogin: null
        }
    };
    const query = {
        text: `
            SELECT 
                idx 
            FROM 
                account 
            WHERE 
                id = $1
                AND
                matched = false
                `,
        values: [couplePartnerId],
    };

    const { rows } = await queryConnect(query);

    if (rows.length == 0) {
        return next({
            message : "일치하는 상대 정보 없음",
            status : 401
        });  
    }

    const couplePartnerIdx = rows.idx
    const insertQuery = {
        text: `
                INSERT INTO 
                    couple (
                        couple1_idx,
                        couple2_idx,
                ) VALUES (
                    $1, $2
                );
            `,
        values: [userIdx, couplePartnerIdx],
    };
    const { rowCount } = await queryConnect(insertQuery);

    if(rowCount==0){
        return next({
            message : "커플 입력 실패",
            status : 401
        });  
    }

    result.success = true;
    result.message = `커플 정보 입력 성공.`;
    result.data = { rows };

    res.send(result);

});

// 커플 정보 등록 api -> 커플 매칭 후!
router.post('/couple', checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const userIdx = req.user.idx
    const { nickname, date } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 등록 실패',
        data: {
            token: "",
            user: null,
            dailyLogin: null,
            totalLogin: null
        }
    };
    const insertQuery = {
        text: `
            INSERT INTO 
                couple (
                    couple1_idx,
                    couple2_idx,
            ) VALUES (
                $1, $2
            );
            `,
        values: [userIdx, nickname, pw, tel, gender],
    };
    const { rowCount } = await queryConnect(insertQuery);

    if (rowCount == 0) {
        return next({
            message : "커플 정보 입력 실패",
            status : 401
        });  
    }

    result.success = true;
    result.message = `커플 정보 입력 성공.`;
    result.data = { rows };

    res.send(result);

});

// 커플 애칭 수정 api
router.put('/couple', checkPattern(nicknameReq, 'nickname'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { id, pw } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 불러오기 실패',
        data: {
            token: "",
            user: null,
            dailyLogin: null,
            totalLogin: null
        }
    };
    const query = {
        text: `
            SELECT 
                idx 
            FROM 
                couple 
            WHERE 
                idx = $1 
                AND 
                account_idx = $2;
                `,
        values: [coupleIdx, userIdx],
    };

    const { rows } = await queryConnect(query);

    if (rows.length == 0) {
        return next({
            message : "일치하는 정보 없음",
            status : 401
        });  
    }

    result.success = true;
    result.message = `커플 정보 불러오기 성공.`;
    result.data = { rows };

    res.send(result);

});

// 커플 연애날짜 수정 api
router.put('/couple', ccheckPattern(dateReq, 'date'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { date } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 불러오기 실패',
        data: {
            token: "",
            user: null,
            dailyLogin: null,
            totalLogin: null
        }
    };
    const query = {
        text: `
            UPDATE 
                account
            SET 
                start_date = $1,
            WHERE 
                idx = $6;
                `,
        values: [date, coupleIdx],
    };

    const { rows } = await queryConnect(query);

    if (rows.length == 0) {
        return next({
            message : "일치하는 정보 없음",
            status : 401
        });  
    }

    result.success = true;
    result.message = `커플 정보 불러오기 성공.`;
    result.data = { rows };

    res.send(result);

});

// 커플 이미지 수정 api
router.put('/couple', checkPattern(imageReq, 'image'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { newImageUrl } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 불러오기 실패',
        data: {
            token: "",
            user: null,
            dailyLogin: null,
            totalLogin: null
        }
    };
    const query = {
        text: `
            UPDATE 
                couple
        SET 
            image_url = $1,
        WHERE 
            idx = $6;
                `,
        values: [newImageUrl, coupleIdx],
    };

    const { rows } = await queryConnect(query);

    if (rows.length == 0) {
        return next({
            message : "일치하는 정보 없음",
            status : 401
        });  
    }

    result.success = true;
    result.message = `커플 정보 불러오기 성공.`;
    result.data = { rows };

    res.send(result);

});

// 커플 이미지 삭제 api
router.delete('/couple', checkPattern(imageReq, 'image'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { deleteImageUrl } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 불러오기 실패',
        data: {
            token: "",
            user: null,
            dailyLogin: null,
            totalLogin: null
        }
    };
    const query = {
        text: `
            DELETE 
                image_url = $1
            FROM 
                couple 
            WHERE 
                couple_idx = $2
                `,
        values: [deleteImageUrl, coupleIdx]
    };

    const { rows } = await queryConnect(query);

    if (rows.length == 0) {
        return next({
            message : "이미지 삭제 실패",
            status : 401
        });  
    }

    result.success = true;
    result.message = `커플 정보 불러오기 성공.`;
    result.data = { rows };

    res.send(result);

});