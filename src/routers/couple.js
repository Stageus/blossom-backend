const router = require("express").Router()
const jwt = require('jsonwebtoken');
//const queryConnect = require('../modules/queryConnect');
const checkPattern = require("../middleware/checkPattern");
const redis = require("redis").createClient();
const { idReq, pwReq, emailReq, nameReq, genderReq, dateReq, addressReq, telReq }= require("../config/patterns");

//커플 정보 불러오기 api
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

//커플 정보 등록 api
router.post('/couple', checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
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

//커플 애칭 수정 api
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

//커플 연애날짜 수정 api
router.put('/couple', ccheckPattern(dateReq, 'date'), async (req, res, next) => {
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

//커플 이미지 수정 api
router.put('/couple', checkPattern(imageReq, 'image'), async (req, res, next) => {
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

//커플 이미지 삭제 api
router.delete('/couple', checkPattern(imageReq, 'image'), async (req, res, next) => {
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