const router = require("express").Router();
const jwt = require('jsonwebtoken');
const checkPattern = require("../middleware/checkPattern");
const conn = require("../config/postgresql");
const upload = require("../modules/uploadImage");
const generateToken = require("../modules/generateToken");
const s3 = require("../config/s3");
const {nicknameReq,imageReq,dateReq }= require("../config/patterns");
const isLogin = require("../middleware/isLogin");

const {loggingMiddleware} = require("../config/mongodb")
router.use(loggingMiddleware);

//상대 찾기 api
router.get('/find/partner', isLogin, checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const userIdx = req.user.idx
    const { couplePartnerId } = req.body;    
    const result = {
        success: false,
        message: '상대 찾기 실패',
        data: null,
    };
    try{
        const sql =`SELECT idx FROM account WHERE idx NOT IN (SELECT couple1_idx FROM couple UNION ALL SELECT couple2_idx FROM couple)`;
        const values = [couplePartnerId];

        const dbResult = await executeSQL(conn, sql, values);
    
        if (dbResult.length == 0) {
            return next({
                message : "일치하는 상대 정보 없음",
                status : 404
            });  
        }
    
        const couplePartnerIdx = dbResult.idx
    
        result.success = true;
        result.message = `상대 찾기 성공.`;
        result.data = { couplePartnerIdx };
    
        res.send(result);

    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// 상대 입력 api
router.post('/:partnerIdx', isLogin, checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const userIdx = req.user.idx;
    const partnerIdx = req.params.idx;
    const result = {
        success: false,
        message: '커플 정보 등록 실패',
        data: null,
    };
    try {
        const insertSql =`INSERT INTO couple (couple1_idx, couple2_idx) VALUES ($1, $2) RETURNING idx;`;
        const insertValues = [userIdx, partnerIdx];

        const dbResult = await executeSQL(conn, insertSql, insertValues);

        rows=dbResult.rows;
        rowCount=dbResult.rowCount;

        const coupleIdx = rows[0].idx;

        if(rowCount === 0) {
            return next({
                message: "커플 입력 실패",
                status: 500
            });  
        }
        
        // 커플 정보가 성공적으로 등록되면 토큰을 재발행하여 커플 정보를 추가
        const newToken = await generateToken(user, coupleIdx);
        
        // 클라이언트에게 새로 발급된 토큰 전달
        res.setHeader('Authorization', `Bearer ${newToken}`);

        result.success = true;
        result.message = `커플 정보 입력 성공.`;
        result.data = { partnerIdx, coupleIdx };
    
        res.send(result);
    
    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// 커플 정보 불러오기 api
router.get('/inform', isLogin, async (req, res, next) => { 
    const coupleIdx = req.user.coupleIdx;
    const userIdx = req.user.idx
    const result = {
        success: false,
        message: '커플 정보 불러오기 실패',
        data: null
    };
    try{
        const sql =`SELECT * FROM couple WHERE idx = $1 AND account_idx = $2;`;
        const values = [coupleIdx, userIdx];

        const dbResult = await executeSQL(conn, sql, values);
    
        if (dbResult.length == 0) {
            return next({
                message : "일치하는 정보 없음",
                status : 404
            });  
        }
    
        result.success = true;
        result.message = `커플 정보 불러오기 성공.`;
        result.data = dbResult;
    
        res.send(result);
    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// 커플 정보 등록 api -> 커플 매칭 후!
router.post('/inform', isLogin, checkPattern(nicknameReq, 'nickname'), checkPattern(dateReq, 'date'), async (req, res, next) => {
    const { nickname, date } = req.body;
    const userIdx = req.user.idx;
    const result = {
        success: false,
        message: '커플 정보 등록 실패',
        data: null
    };
    try {
        // 트랜잭션 시작
        await conn.query('BEGIN');

        const selectPartnerQuery = `SELECT COALESCE(NULLIF(couple1_idx, $1), couple2_idx) AS partner_idx
                                    FROM couple WHERE couple1_idx = $1 OR couple2_idx = $1 RETURNING partner_idx `;
        const selectValues = [userIdx];

        const dbResult = await executeSQL(conn, selectPartnerQuery, selectValues);

        if (dbResult == 0) {
            // 롤백 후 에러 처리
            await conn.query('ROLLBACK');
            return next({
                message: "커플 상대방 조회 오류",
                status: 404
            })
        }

        const couplePartnerIdx = dbResult[0].partner_idx;

        const updateAccountQuery = `UPDATE account SET nickname = $1 WHERE idx = $2;`;
        const updateValues = [nickname, couplePartnerIdx];

        const updateAccountResult = await executeSQL(conn, updateAccountQuery, updateValues);
        const rowCount = updateAccountResult.rowCount;

        if (rowCount == 0) {
            // 롤백 후 에러 처리
            await conn.query('ROLLBACK');
            return next({
                message: "커플 애칭 입력 실패",
                status: 500
            });
        }

        const updateCoupleQuery = `UPDATE couple SET start_date = $1 WHERE couple1_idx = $2 OR couple2_idx = $2;`;
        const updateCoupleValues = [date, couplePartnerIdx];

        const queryResult = await executeSQL(conn, updateCoupleQuery, updateCoupleValues);

        const updateResult = queryResult.rowCount;

        if (updateResult == 0) {
            // 롤백 후 에러 처리
            await conn.query('ROLLBACK');
            return next({
                message: "커플 날짜 입력 실패",
                status: 500
            });
        }

        // 트랜잭션 커밋
        await conn.query('COMMIT');

        result.success = true;
        result.message = `커플 날짜 입력 성공.`;

        res.send(result);
    } catch (error) {
        // 에러 발생 시 롤백 후 에러 처리
        await conn.query('ROLLBACK');
        result.error = error;
        return next(error);
    } finally {
        // 커넥션 반환
        await conn.release();
    }
});

// 커플 연애날짜 수정 api
router.put('/date', isLogin, checkPattern(dateReq, 'date'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { date } = req.body;    
    const result = {
        success: false,
        message: '연애 날짜 수정 실패',
        data: null
    };

    try{
        await conn.query('BEGIN');

        const query = `SELECT couple1_idx, couple2_idx FROM couple WHERE idx = $1 AND account_idx = $2;`;
        const values = [coupleIdx, userIdx];

        const dbResult = await executeSQL(conn, query, values);
    
        if (dbResult.length == 0) {
            await conn.query('ROLLBACK');
            return next({
                message : "일치하는 정보 없음",
                status : 404
            });  
        }
    
        const couple1_idx = dbResult[0].couple1_idx;
        const couple2_idx = dbResult[0].couple2_idx;
    
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
            await conn.query('ROLLBACK');
            return next({
                message : "연애 날짜 수정 실패",
                status : 500
            });  
        }

        // 트랜잭션 커밋
        await conn.query('COMMIT');
    
        result.success = true;
        result.message = `연애 날짜 수정 성공.`;
    
        res.send(result);
    } catch (error) {
        await conn.query('ROLLBACK');
        result.error = error;
        return next(error);
    }
});

// 커플 이미지 수정 api
router.put('/image', isLogin, checkPattern(imageReq, 'image'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx; // 토큰에 coupleIdx 추가하기
    const userIdx = req.user.idx
    const { deleteImageUrl, file } = req.body;    
    const result = {
        success: false,
        message: '커플 이미지 수정 실패',
        data: null
    };

    try{
        await conn.query('BEGIN');

        if (deleteImageUrl) {
            // deleteImageUrl에서 추가 문자를 제거.
            const cleanedDeleteImageUrl = deleteImageUrl.trim();
            
            // 삭제할 이미지의 S3 URL 가져오기
            const deleteImageQuery = `DELETE image_url FROM couple WHERE idx = $1;`;
            const deleteImagevalues = [coupleIdx];

            const deleteResult =  await executeSQL(conn, deleteImageQuery, deleteImagevalues);
    
            if(deleteResult==0){
                await conn.query('ROLLBACK');
                return next({
                    message : "커플 이미지 삭제 실패",
                    status : 500
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
    
            const dbResult = await executeSQL(conn, query, values);
            const rowCount = dbResult.rowCount;

            if(rowCount==0){
                await conn.query('ROLLBACK');
                return next({
                    message : "커플 이미지 수정 실패",
                    status : 500
                });  
            }
        }
        await conn.query('COMMIT');
    
        result.success = true;
        result.message = `커플 이미지 수정 성공.`;
    
        res.send(result);
    } catch (error) {
        await conn.query('ROLLBACK');
        result.error = error;
        return next(error);
    }
});

// 커플 애칭 수정 api
router.put('/nickname', isLogin, checkPattern(nicknameReq, 'nickname'), async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx;
    const userIdx = req.user.idx
    const { nickname } = req.body;    
    const result = {
        success: false,
        message: '상대 닉네임 수정 실패',
        data: null
    };

    try {
        // 트랜잭션 시작
        await conn.query('BEGIN');

        const query = `SELECT couple1_idx, couple2_idx FROM couple WHERE idx = $1 AND account_idx = $2;`;
        const values = [coupleIdx, userIdx];

        const dbResult = await executeSQL(conn, query, values);

        if (dbResult.length == 0) {
            await conn.query('ROLLBACK');
            return next({
                message : "일치하는 정보 없음",
                status : 404
            });  
        }

        const couple1_idx = dbResult[0].couple1_idx;
        const couple2_idx = dbResult[0].couple2_idx;

        let couplePartnerIdx;
        if (couple1_idx != userIdx) {
            couplePartnerIdx = couple1_idx;
        } else {
            couplePartnerIdx = couple2_idx;
        }

        const updateCoupleQuery = `UPDATE account SET nickname = $1 WHERE idx = $2`;
        const updateCoupleValues = [nickname, couplePartnerIdx];

        const queryResult = await executeSQL(conn, updateCoupleQuery, updateCoupleValues);
        const updateResult = queryResult.rowCount;

        if (updateResult == 0) {
            await conn.query('ROLLBACK');
            return next({
                message : "상대 닉네임 수정 실패",
                status : 500
            });  
        }

        // 트랜잭션 커밋
        await conn.query('COMMIT');

        result.success = true;
        result.message = `상대 닉네임 수정 성공.`;
        
        res.send(result);
    } catch (error) {
        // 에러 발생 시 롤백 후 에러 처리
        await conn.query('ROLLBACK');
        result.error = error;
        return next(error);
    }
});

module.exports = router;