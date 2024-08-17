const router = require("express").Router();
const isLogin = require('../middleware/isLogin');
const conn = require("../config/postgresql");
const checkPattern = require("../middleware/checkPattern");
const { contentReq } = require("../config/patterns");
const { executeSQL } = require("../modules/sql");
const {loggingMiddleware} = require("../config/mongodb")
router.use(loggingMiddleware);

// 수정해봄 

// 문답 전체 목록 불러오기 API
router.get("/all", isLogin, async (req, res, next) => {
    const coupleIdx = req.user.coupleIdx;
    const lastQuestionIdx = req.query.lastQuestionIdx || 20; // 마지막으로 로드된 질문의 인덱스
    const itemSize = 20; // 페이지당 항목 수
    const result = {
        success: false,
        message: "",
        data: {
            questions: []
        }
    };

    try {
        const query = ` SELECT q.question
                        FROM question q
                        JOIN couple c ON c.idx = $1
                        WHERE q.create_at >= (SELECT create_at FROM couple WHERE idx = $1)
                        AND q.idx < $2
                        ORDER BY q.create_at DESC
                        LIMIT $3;
        `;
        const values = [coupleIdx, lastQuestionIdx, itemSize];


        const dbResult = await executeSQL(conn, query, values);

        console.log(dbResult);

        if (dbResult.length == 0) {
            return next({
                message : "일치하는 정보 없음",
                status : 404
            });  
        }
        
        result.data.questions = dbResult;

        result.success = true;
        result.message = "질문 목록 불러오기 성공";    
        res.send(result);

    } catch (error) {
        console.error('질문 목록 불러오기 오류: ', error);
        result.message = "질문 목록 불러오기 실패";
        return next(error);
    }
});

// 특정 문답 불러오기 API
router.get("/:idx", isLogin, async (req, res, next) => {
    const questionIdx = req.params.idx;
    const userIdx = req.user.idx;
    const coupleIdx = req.user.coupleIdx;
    const result = {
        success: false,
        message: "",
        data: {
            myAnswer: null,
            partnerAnswer:null
        },
    };
    try {

        const selectPartnerQuery = `SELECT couple1_idx, couple2_idx FROM couple WHERE idx=$1`;
        const values = [coupleIdx];
        console.log("values: ", values)

        const dbResult = await executeSQL(conn, selectPartnerQuery, values);

        if (dbResult == 0) {
            return next({
                message: "커플 상대방 조회 오류",
                status: 404
            })
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

        const selectQuery =`SELECT content FROM answer
                            WHERE account_idx = $1
                            AND question_idx = $2;`;
        const selectValues = [couplePartnerIdx, questionIdx];

        const findResult =  await executeSQL(conn, selectQuery, selectValues);
        console.log("findResult: ",findResult)

        //const findRows = findResult.rows[0]

        if (findResult == 0) {
            return next({
                message: '상대 답변 불러오기 실패',
                status: 500
            });
        } 
        
        const mySelectQuery =`SELECT content FROM answer
                            WHERE account_idx = $1
                            AND question_idx = $2;`;
        const mySelectValues = [userIdx, questionIdx];

        const myResult = await executeSQL(conn, mySelectQuery, mySelectValues);
        console.log("myResult: ",myResult)


        //const myRows = myResult.rows[0]

        if (myResult == 0) {
            return next({
                message: '내 답변 불러오기 실패',
                status: 500
            });
        } 

        result.data.myAnswer = findResult;
        result.data.partnerAnswer = myResult;

        result.success = true;
        
        res.send(result);

    } catch (error) {
        console.error('답변 가져오기 오류 발생: ', error.message);
        result.message = error.message;
        return next(error);
    }
});

// 문답 답변 쓰기 API
router.post("/:idx", checkPattern(contentReq, "content"), isLogin, async (req, res, next) => {
    const userIdx = req.user.idx;
    const coupleIdx = req.user.coupleIdx;
    const questionIdx = req.params.idx;
    const { content } = req.body;
    const result = {
        success: false,
        message: "",
        data: null
    };
    try {
        const answerInsertQuery =`INSERT INTO answer (content, account_idx, couple_idx, question_idx) VALUES ($1, $2, $3, $4)`;
        const values = [content, userIdx, coupleIdx, questionIdx];

        const dbResult = await executeSQL(conn, answerInsertQuery, values);
        const rowCount = dbResult.rowCount;

        if(rowCount==0){
            return next({
                message: '답변 작성 실패',
                status: 500
            });
        }
        result.success = true;
        result.message = "답변 등록 성공";

        res.send(result);

    } catch (e) {
        result.message = e.message;
        return next(e);
    }
});

module.exports = router;