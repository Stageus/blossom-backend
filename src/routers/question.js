const router = require("express").Router();
const isLogin = require('../middleware/isLogin');
const conn = require("../config/postgresql");
const makeLog = require("../modules/makelog");
const isBlank = require("../middleware/isBlank")

// 문답 전체 목록 불러오기 API
router.get("/question/all", isLogin, async (req, res, next) => {
    const result = {
        success: false,
        message: "",
        data:{
            questions: []
        }
    };

    try {
        const query = { //커플 create_at에서 현재 날짜를 뺀 그 총 일수만큼 question 불러오기
            text: ` SELECT q.*
                    FROM question q
                    JOIN couple c ON q.couple_idx = c.idx
                    WHERE c.idx = $1
                    AND q.create_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                    ORDER BY q.create_at DESC;
            `,
        };
        
        const { rows } = await queryConnect(query);
        result.data.questions = rows.question;

        result.success = true;
        result.message = "질문 목록 불러오기 성공";    
        res.send(result);

        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/question/all',
            restMethod: 'get',
            inputData: {  },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);

    } catch (error) {
        console.error('질문 목록 불러오기 오류: ', error);
        result.message = "질문 목록 불러오기 실패";
        return next(error);
    }
});

// 특정 문답 불러오기 API
router.get("/question/:idx", isLogin, async (req, res, next) => {
    const questionIdx = req.params.questionIdx;
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

        let partnerIdx;

        const findPartnerQuery ={
            text:`  SELECT COALESCE(NULLIF(couple1_idx, $1), couple2_idx) AS partner_idx
                    FROM couple
                    WHERE couple1_idx = $1 OR couple2_idx = $1;
                    RETURNING partner_idx
                    `,
            values: [userIdx]
        };

        const { rows } = await queryConnect(findPartnerQuery);

        if (rows.length == 0) {
            return next({
                message: '상대방 idx 불러오기 실패',
                status: 500
            });
        } 

        partnerIdx = rows[0].partner_idx;

        const partnerQuery = {
            text: ` SELECT * FROM answer
                    WHERE account_idx = $1
                    AND question_idx = $2;`
            ,
            values: [coupleIdx, questionIdx],
        };

        const findResult = await queryConnect(partnerQuery);
        const findRows = findResult.rows[0]

        if (findRows.length == 0) {
            return next({
                message: '상대 답변 불러오기 실패',
                status: 500
            });
        } 

        const myQuery = {
            text: ` SELECT * FROM answer
                    WHERE account_idx = $1
                    AND question_idx = $2;`
            ,
            values: [userIdx, questionIdx],
        };

        const myResult = await queryConnect(myQuery);
        const myRows = myResult.rows[0]

        if (myRows.length == 0) {
            return next({
                message: '내 답변 불러오기 실패',
                status: 500
            });
        } 

        const sqlMyAnswer = findRows[0].content;
        const sqlPartnerAnswer = myRows[0].content;

        result.data.myAnswer = sqlMyAnswer;
        result.data.partnerAnswer = sqlPartnerAnswer;

        result.success = true;
        
        res.send(result);

        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/question/:idx',
            restMethod: 'get',
            inputData: {  },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);
    } catch (error) {
        console.error('답변 가져오기 오류 발생: ', error.message);
        result.message = error.message;
        return next(error);
    }
});

// 문답 답변 쓰기 API -> 수정하기
router.post("question/:idx", isLogin, isBlank('content'), async (req, res, next) => {
    const userIdx = req.user.idx;
    const coupleIdx = req.user.coupleIdx;
    const questionIdx = req.params.questionIdx;
    const { content } = req.body;
    const result = {
        success: false,
        message: "",
        data: null
    };
    try {
        const answerInsertQuery = {
            text: 'INSERT INTO answer (content, account_idx, couple_idx, question_idx) VALUES ($1, $2, $3, $4)',
            values: [content, userIdx, coupleIdx, questionIdx]
        };

        const { rowCount } = await queryConnect(answerInsertQuery);
        if(rowCount==0){
            return next({
                message: '답변 작성 실패',
                status: 500
            });
        }
        result.success = true;
        result.message = "답변 등록 성공";

        res.send(result);

        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/question/:idx',
            restMethod: 'post',
            inputData: { content },
            outputData: result,
            time: new Date(),
        };
    
        makeLog(req, res, logData, next);

    } catch (e) {
        result.message = e.message;
        return next(e);
    }
});

module.exports = router;