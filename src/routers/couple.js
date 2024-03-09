const router = require("express").Router()
const jwt = require('jsonwebtoken');
//const queryConnect = require('../modules/queryConnect');
const checkPattern = require("../middleware/checkPattern");
const redis = require("redis").createClient();
const upload = require("../config/multer");
const s3 = require("../config/s3")
const { idReq, pwReq, nameReq, dateReq, telReq }= require("../config/patterns");

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
        data: null
    };
    const query = {
        text: `
            SELECT 
                * 
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

//커플 상대찾기 api => 상대찾기랑 닉네임 사귄날짜 입력을 따로 분리해야하는지? 일단 분리함, 그리고 get인지 post인지 헷갈림
router.post('/couple', checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const userIdx = req.user.idx
    const { couplePartnerId } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 등록 실패',
        data: null,
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
    result.data = { couplePartnerIdx };

    res.send(result);

});

// 커플 정보 등록 api -> 커플 매칭 후!
router.post('/couple', checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const userIdx = req.user.idx
    const { couplePartnerIdx, nickname, date } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 등록 실패',
        data: null
    };

    const updateAccountQuery = {
        text: `
        UPDATE 
            account
        SET 
            nickname = $1,
        WHERE 
            idx = $2;
            `,
        values: [nickname, couplePartnerIdx],
    };

    const { rowCount } = await queryConnect(updateAccountQuery);

    if (rowCount == 0) {
        return next({
            message : "커플 정보 입력 실패",
            status : 401
        });  
    }

    const updateCoupleQuery = {
        text: `
        UPDATE 
            couple
        SET 
            start_date = $1,
        WHERE 
            couple1_idx = $2
        OR
            couple2_idx = $2;
            `,
        values: [date, couplePartnerIdx], //userIdx 넣어도 됨
    };

    const queryResult = await queryConnect(updateCoupleQuery);
    const updateResult = queryResult.rowCount;

    if(updateResult==0){
        return next({
            message : "커플 정보 입력 실패",
            status : 401
        });  
    }

    result.success = true;
    result.message = `커플 정보 입력 성공.`;
    //result.data = {  };

    res.send(result);

});

// 커플 애칭 수정 api
router.put('/couple', checkPattern(nicknameReq, 'nickname'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { nickname } = req.body;    
    const result = {
        success: false,
        message: '상대 닉네임 수정 실패',
        data: null
    };
    const query = {
        text: `
            SELECT 
                couple1_idx, couple2_idx 
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

    const couple1_idx = rows[0].couple1_idx;
    const couple2_idx = rows[0].couple2_idx;

    let couplePartnerIdx;
    if(couple1_idx!=userIdx){
        couplePartnerIdx=couple1_idx;
    } 
    else{
        couplePartnerIdx=couple2_idx;
    }

    const updateCoupleQuery = {
        text: `
        UPDATE 
            account
        SET 
            nickname = $1,
        WHERE 
            idx = $2
            `,
        values: [nickname, couplePartnerIdx], //userIdx 넣어도 됨
    };

    const queryResult = await queryConnect(updateCoupleQuery);
    const updateResult = queryResult.rowCount;

    if(updateResult==0){
        return next({
            message : "상대 닉네임 수정 실패",
            status : 401
        });  
    }

    result.success = true;
    result.message = `상대 닉네임 수정 실패.`;
    //result.data = {  };

    res.send(result);

});

// 커플 연애날짜 수정 api
router.put('/couple', checkPattern(dateReq, 'date'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { date } = req.body;    
    const result = {
        success: false,
        message: '연애 날짜 수정 실패',
        data: null
    };
    const query = {
        text: `
            SELECT 
                couple1_idx, couple2_idx 
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

    const couple1_idx = rows[0].couple1_idx;
    const couple2_idx = rows[0].couple2_idx;

    let couplePartnerIdx;
    if(couple1_idx!=userIdx){
        couplePartnerIdx=couple1_idx;
    } 
    else{
        couplePartnerIdx=couple2_idx;
    }

    const updateCoupleQuery = {
        text: `
        UPDATE 
            account
        SET 
            start_date = $1,
        WHERE 
            idx = $2
            `,
        values: [date, coupleIdx], //userIdx 넣어도 됨
    };

    const queryResult = await queryConnect(updateCoupleQuery);
    const updateResult = queryResult.rowCount;

    if(updateResult==0){
        return next({
            message : "연애 날짜 수정 실패",
            status : 401
        });  
    }

    result.success = true;
    result.message = `연애 날짜 수정 성공.`;
    //result.data = {  };

    res.send(result);

});

// 커플 이미지 수정 api
router.put('/couple', upload.single("file"), checkPattern(imageReq, 'image'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { deleteImageUrl } = req.body;    
    const result = {
        success: false,
        message: '커플 이미지 수정 실패',
        data: null
    };
    if (deleteImageUrl) {
        // deleteImageUrl에서 추가 문자를 제거.
        const cleanedDeleteImageUrl = deleteImageUrl.trim();
        
        // 삭제할 이미지의 S3 URL 가져오기
        const deleteImageQuery = {
            text: 'DELETE image_url FROM couple WHERE idx = $1',
            values: [coupleIdx],
        };
    
        const deleteResult = await queryConnect(deleteImageQuery);

        if(deleteResult==0){
            return next({
                message : "커플 이미지 삭제 실패",
                status : 401
            })
        }
    
        // S3에서 이미지 삭제
        const imageKey = cleanedDeleteImageUrl;
        const decodedKey = decodeURIComponent(imageKey.split('/').pop());
        await s3.deleteObject({ Bucket: 'sohyunxxistageus', Key: `uploads/${decodedKey}` }).promise();
    
        } else {
            console.log("deleteImageUrl에 대한 이미지를 찾을 수 없습니다:", cleanedDeleteImageUrl);
            result.message = "deleteImageUrl에 대한 이미지를 찾을 수 없습니다:";
            //return res.send(result);
        }
    
    if (file) {
        
        const imageUrl = file.location;

        // 이미지 테이블에 이미지 저장
        const imageInsertQuery = {
            text: 'INSERT INTO couple (image_url) VALUES ($1)',
            values: [imageUrl]
        };

        const {rowCount} = await queryConnect(imageInsertQuery);
        if(rowCount==0){
            return next({
                message : "커플 이미지 수정 실패",
                status : 401
            });  
        }
    }

    result.success = true;
    result.message = `커플 이미지 수정 성공.`;
    //result.data = {  };

    res.send(result);

});

// 커플 이미지 삭제 api
router.delete('/couple', checkPattern(imageReq, 'image'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { deleteImageUrl } = req.body;    
    const result = {
        success: false,
        message: '커플 이미지 삭제 실패',
        data: null
    };
    if (deleteImageUrl) {
        // deleteImageUrl에서 추가 문자를 제거.
        const cleanedDeleteImageUrl = deleteImageUrl.trim();
        
        // 삭제할 이미지의 S3 URL 가져오기
        const deleteImageQuery = {
            text: 'DELETE image_url FROM couple WHERE idx = $1',
            values: [coupleIdx],
        };
    
        const deleteResult = await queryConnect(deleteImageQuery);

        if(deleteResult==0){
            return next({
                message : "커플 이미지 삭제 실패",
                status : 401
            })
        }
    
        // S3에서 이미지 삭제
        const imageKey = cleanedDeleteImageUrl;
        const decodedKey = decodeURIComponent(imageKey.split('/').pop());
        await s3.deleteObject({ Bucket: 'sohyunxxistageus', Key: `uploads/${decodedKey}` }).promise();
    
        } else {
            console.log("deleteImageUrl에 대한 이미지를 찾을 수 없습니다:", cleanedDeleteImageUrl);
            result.message = "deleteImageUrl에 대한 이미지를 찾을 수 없습니다:";
            //return res.send(result);
        }

    result.success = true;
    result.message = `커플 정보 불러오기 성공.`;
    result.data = { rows };

    res.send(result);

});