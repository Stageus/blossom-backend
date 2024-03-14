const router = require("express").Router()
const jwt = require('jsonwebtoken');
const checkPattern = require("../middleware/checkPattern");
const makeLog = require("../modules/makelog");
const conn = require("../config/postgresql")
const redis = require("redis").createClient();
const upload = require("../config/multer");
const s3 = require("../config/s3")
const {nicknameReq,imageReq,dateReq }= require("../config/patterns");

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
    try{
        const sql =`SELECT * FROM couple WHERE idx = $1 AND account_idx = $2;`;
        const values = [coupleIdx, userIdx];

        const { rows } = await executeSQL(conn, sql, values);
    
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
    
        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/couple/:idx',
            restMethod: 'get',
            inputData: {  },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);
    } catch (error) {
        result.error = error;
        return next(error);
    }
});

//커플 상대찾기 api => 상대찾기랑 닉네임 사귄날짜 입력을 따로 분리해야하는지? 일단 분리함, 그리고 get인지 post인지 헷갈림
router.get('/couple/find/partner', checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const userIdx = req.user.idx
    const { couplePartnerId } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 등록 실패',
        data: null,
    };
    try{// id 주고 그에 맞는 idx 가진 사람들 중에서 고르는거!
        const sql =`SELECT idx FROM account WHERE idx NOT IN (SELECT couple1_idx FROM couple UNION ALL SELECT couple2_idx FROM couple)`;
        const values = [couplePartnerId];

        const { rows } = await executeSQL(conn, sql, values);
    
        if (rows.length == 0) {
            return next({
                message : "일치하는 상대 정보 없음",
                status : 401
            });  
        }
    
        //개발 하다보니 이걸 나눠야하지않나? 이부분은 post 아닌감..
        const couplePartnerIdx = rows.idx

        const insertSql =`INSERT INTO couple (couple1_idx, couple2_idx) VALUES ($1, $2);`;
        const insertValues = [userIdx, couplePartnerIdx];

        const { rowCount } = await executeSQL(conn, insertSql, insertValues);

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
    
        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/couple/find/partner',
            restMethod: 'get',
            inputData: {  },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);
    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// 커플 정보 등록 api -> 커플 매칭 후!
router.post('/couple/inform', checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const userIdx = req.user.idx
    const { couplePartnerIdx, nickname, date } = req.body;    
    const result = {
        success: false,
        message: '커플 정보 등록 실패',
        data: null
    };
    try{
        const updateAccountQuery =`UPDATE account SET nickname = $1 WHERE idx = $2;`;
        const updateValues = [nickname, couplePartnerIdx];

        const { rowCount } = await executeSQL(conn, updateAccountQuery, updateValues);

        if (rowCount == 0) {
            return next({
                message : "커플 정보 입력 실패",
                status : 401
            });  
        }
        
        const updateCoupleQuery =`UPDATE couple SET start_date = $1 WHERE couple1_idx = $2 OR couple2_idx = $2;`;
        const updateCoupleValues = [date, couplePartnerIdx];

        const queryResult = await executeSQL(conn, updateAccountQuery, updateCoupleValues);

        await queryConnect(updateCoupleQuery);
        const updateResult = queryResult.rowCount;
    
        if(updateResult==0){
            return next({
                message : "커플 정보 입력 실패",
                status : 401
            });  
        }
    
        result.success = true;
        result.message = `커플 정보 입력 성공.`;
        
        res.send(result);
    
        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/couple/inform',
            restMethod: 'post',
            inputData: { couplePartnerIdx, nickname, date },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);
    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// 커플 애칭 수정 api -> api명 뒤에 nickname 추가?
router.put('/couple/inform', checkPattern(nicknameReq, 'nickname'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx;
    const userIdx = req.user.idx
    const { nickname } = req.body;    
    const result = {
        success: false,
        message: '상대 닉네임 수정 실패',
        data: null
    };

    try{
        const query =`SELECT couple1_idx, couple2_idx FROM couple WHERE idx = $1 AND account_idx = $2;`;
        const values = [coupleIdx, userIdx];

        const { rows } = await executeSQL(conn, query, values);
    
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
        const updateCoupleQuery = `UPDATE account SET nickname = $1 WHERE idx = $2`;
        const updateCoupleValues = [nickname, couplePartnerIdx];

        const queryResult = await executeSQL(conn, updateCoupleQuery, updateCoupleValues);
        const updateResult = queryResult.rowCount;
    
        if(updateResult==0){
            return next({
                message : "상대 닉네임 수정 실패",
                status : 401
            });  
        }
    
        result.success = true;
        result.message = `상대 닉네임 수정 실패.`;
        res.send(result);
    
        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/couple/inform',
            restMethod: 'put',
            inputData: { nickname },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);
    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// 커플 연애날짜 수정 api
router.put('/couple/inform', checkPattern(dateReq, 'date'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { date } = req.body;    
    const result = {
        success: false,
        message: '연애 날짜 수정 실패',
        data: null
    };

    try{
        const query = `SELECT couple1_idx, couple2_idx FROM couple WHERE idx = $1 AND account_idx = $2;`;
        const values = [coupleIdx, userIdx];

        const { rows } = await executeSQL(conn, query, values);
    
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
        const updateCoupleQuery = `UPDATE couple SET start_date = $1 WHERE idx = $2`;
        const updateCoupleValues = [date, coupleIdx];

        const queryResult = await executeSQL(conn, updateCoupleQuery, updateCoupleValues);
    
        const updateResult = queryResult.rowCount;
    
        if(updateResult==0){
            return next({
                message : "연애 날짜 수정 실패",
                status : 401
            });  
        }
    
        result.success = true;
        result.message = `연애 날짜 수정 성공.`;
    
        res.send(result);
    
        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/couple/inform',
            restMethod: 'put',
            inputData: { nickname },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);
    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// 커플 이미지 수정 api => 희주가 만든 업로드 모델로 수정하기
router.put('/couple', upload.single("file"), checkPattern(imageReq, 'image'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { deleteImageUrl } = req.body;    
    const result = {
        success: false,
        message: '커플 이미지 수정 실패',
        data: null
    };

    try{
        if (deleteImageUrl) {
            // deleteImageUrl에서 추가 문자를 제거.
            const cleanedDeleteImageUrl = deleteImageUrl.trim();
            
            // 삭제할 이미지의 S3 URL 가져오기
            const deleteImageQuery = `DELETE image_url FROM couple WHERE idx = $1;`;
            const deleteImagevalues = [coupleIdx];

            const deleteResult =  await executeSQL(conn, deleteImageQuery, deleteImagevalues);
    
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
            }
        
        if (file) {
            
            const imageUrl = file.location;
    
            // 이미지 테이블에 이미지 저장
            const query = `INSERT INTO couple (image_url) VALUES ($1);`;
            const values = [imageUrl];
    
            const {rowCount} = await executeSQL(conn, query, values);

            if(rowCount==0){
                return next({
                    message : "커플 이미지 수정 실패",
                    status : 401
                });  
            }
        }
    
        result.success = true;
        result.message = `커플 이미지 수정 성공.`;
    
        res.send(result);
    
        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/couple/inform',
            restMethod: 'put',
            inputData: { deleteImageUrl, file },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);
    } catch (error) {
        result.error = error;
        return next(error);
    }
});