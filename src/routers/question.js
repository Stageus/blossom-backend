const router = require("express").Router();
const isLogin = require('../middleware/isLogin');
const queryConnect = require('../modules/queryConnect');
const makeLog = require("../modules/makelog");
const isBlank = require("../middleware/isBlank")
const redis = require("redis").createClient();

// 문답 전체 목록 불러오기 API
router.get("/", isLogin, async (req, res, next) => {
    const userId = req.user.id;  
    const coupleIdx = req.user.coupleIdx;
    const result = {
        success: false,
        message: "",
        data:{
            questions: []
        }
    };

    try {
        const query = { //couple_idx 추가해야할듯? -> 그 커플에게 할당된 질문을 확인하기 위해서
            text: `
                SELECT 
                    *, 
                FROM 
                    question
                WHERE
                    couple_idx=$1
            `,
            values: [coupleIdx],
        };
        
        const { rows } = await queryConnect(query);
        result.data.questions = rows.question;

        result.success = true;
        result.message = "질문 목록 불러오기 성공";    
        res.send(result);

    } catch (error) {
        console.error('질문 목록 불러오기 오류: ', error);
        result.message = "질문 목록 불러오기 실패";
        return next(error);
    }
});

// 문답 검색하기 => 명세서에 없는데...?
router.get("/search", isLogin, async (req, res, next) => {
    const userIdx = req.user.idx
    const userId = req.user.id
    const { date } = req.query // query 안쓴다했는데 get은 시간 검색시 써야하지않나?
    const time = new Date() //timestamp
    const result = {
        "message": "",
        "data": {
            "searchedQuestion": null,
        }
    }
    try { 
       
        const query = {
            text: `
                SELECT 
                    *
                FROM 
                    question
                WHERE 
                    couple_idx = $1
            `,
            values: [`%${title}%`],
        };
        const {rowCount, rows}= await queryConnect(query);

        if (rowCount == 0) {
            result.message = "게시물 없음."
        } else {
            result.data.searchPost = rowCount
            result.message = rows;
        }
       
        return res.status(200).send(result);
    } catch (error) {
        next(error)
    } finally {
        await redis.disconnect()
    }
})


// 특정 문답 불러오기 API
router.get("/:questionIdx", isLogin, async (req, res, next) => {
    const questionIdx = req.params.questionIdx;
    const userIdx = req.user.idx;
    const coupleIdx = req.user.coupleIdx;
    const result = {
        success: false,
        message: "",
        data: null,
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
                message: '게시물 불러오기 실패',
                status: 500
            });
        } 

        partnerIdx = rows[0].partner_idx;

        const query = { // 어려워.... 답변 2개 나올것. 그런데 그 답변에 해당하는 idx 가져와서 넣기?
            text: ` SELECT 
                        q.question, 
                        a.content,
                        a.account_idx AS answerer_idx
                    FROM 
                        question q
                    JOIN 
                        answer a ON q.idx = a.question_idx
                    WHERE 
                        q.idx = $1 AND 
                        q.couple_idx = $2;`
            ,
            values: [questionIdx, coupleIdx],
        };

        const findResult = await queryConnect(query);
        const findRows = findResult.rows[0]

        if (findRows.length == 0) {
            return next({
                message: '답변 불러오기 실패',
                status: 500
            });
        } 

        const question = findRows[0].question;

        //답변 분류하기 => 여기가 고민중... if문써서??
        const myAnswer = findRows[0].content;
        const partnerAnswer = findRows[0].content;

        result.success = true;
        result.data = post; 
        
        res.send(result);
    } catch (error) {
        console.error('게시물 가져오기 오류 발생: ', error.message);
        result.message = error.message;
        return next(error);
    }
});

// 문답 답변 쓰기 API 
router.post("/:questionIdx", isLogin, isBlank('content'), async (req, res, next) => {
    const userIdx = req.user.idx;
    const coupleIdx = req.user.coupleIdx;
    const questionIdx = req.params.questionIdx;
    const { content } = req.body;
    const files = req.files;
    const result = {
        success: false,
        message: "",
        data: null
    };
    console.log("파일들: ",files)
    try {
        // 포스트 테이블에 게시물 등록
        const postInsertQuery = {
            text: 'INSERT INTO answer (content, account_idx, couple_idx, question_idx) VALUES ($1, $2, $3, $4)',
            values: [content, userIdx, coupleIdx, questionIdx]
        };

        const { rowCount } = await queryConnect(postInsertQuery);
        if(rowCount==0){
            return next({
                message: '답변 작성 실패',
                status: 500
            });
        }
        result.success = true;
        result.message = "답변 등록 성공";
        //result.data = {};

        res.send(result);

    } catch (e) {
        result.message = e.message;
        return next(e);
    }
});

module.exports = router;