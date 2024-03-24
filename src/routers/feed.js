const router = require("express").Router();
const jwt = require("jsonwebtoken");
const checkPattern = require("../middleware/checkPattern");
const isBlank = require("../middleware/isBlank");
const { idReq,pwReq,nameReq,nicknameReq,imageReq,telReq,dateReq,feedReq } = require("../config/patterns");
const { uploadImage } = require("../modules/uploadImage")
const { s3 } = require("../config/s3")

const conn = require("../config/postgresql");

// feed table의 date = date type (YYYY-MM-DD)

// 1. get feed/all 피드 전체 불러오기
router.get("all", isLogin, async(req, rex, next) => {
    const { coupleIdx } = req.user;
    
    const result = {
        success : false,
        message : "",
        data : null
    }

    try{
        // 피드 전체 최신순으로 가져오기
        const sql = "SELECT * FROM feed WHERE is_delete = false AND couple_idx = $1 ORDER BY create_at DESC";
        const values = [coupleIdx];

        const dbResult = await executeSQL(conn, sql, values);
    
        // 피드 전체 가져오기 성공시
        result.success = true;
        result.data = dbResult;
        result.message = "모든 피드 가져오기 성공";
        res.status(200).send(result);
        
    }catch(e){
        next(e);
    }
})

// 2. get feed/search 날짜로 검색한 피드 불러오기
router.get("/search", isLogin, checkPattern(dateReq, "date"), async(req, res, next) => {
    const { coupleIdx } = req.user;
    const { date } = req.body; // YYYY-MM-DD (postgresql table의 date는 timestamp지만 비교가능)

    const result = {
        success : false,
        message : '',
        data : null 
    };

    try{
        const sql = "SELECT * FROM feed WHERE date = $1 AND couple_idx = $2 AND is_delete = false ORDER BY create_at DESC"
        const values = [date, coupleIdx];
        const dbResult = await executeSQL(conn, sql, values);

        if (!dbResult || dbResult.length == 0) {
            result.message = `${date} 날짜에 해당하는 피드가 없거나 접근 권한이 없습니다`;
            // 404 안보내고 그냥 빈 list로 보내겠다
        }
        else{
            result.message = `${date} 날짜에 해당하는 피드 가져오기 성공`;
        }
        result.success = true;
        result.data = dbResult;
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 3. post feed 피드 작성하기
router.post("/", isLogin, isBlank("content"), checkPattern(dateReq, "date"), async(req,res,next) => {
    const {coupleIdx, accountIdx} = req.user; // isLogin에서 token해석해서 전달
    // date = 년,월,일 type
    const {content, date} = req.body;
    
    // 이미지(0~1장) -> 이미지가 있을 경우에만 업로드 함수 실행
    let image;
    if(req.files && req.files.image){
        image = uploadImage("image");
    }

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `INSERT INTO feed (couple_idx, account_idx, content, date, image_url)
                     VALUES ($1, $2, $3, $4, $5)`;
        const values = [coupleIdx, accountIdx, content, date, image];
    
        await executeSQL(conn, sql, values);

        // 피드 작성 성공시
        result.success = true;
        result.message = "피드 작성 성공";
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 4. put feed/:idx 특정 피드 수정하기
router.put("/:idx", isLogin, checkPattern(feedReq, "content"), async(req, res, next) => {
    const { coupleIdx } = req.user; //--> isLogin에서 토큰 확인후 couple_idx와 account_idx 줘야함
    const {content, fileFlag} = req.body; // fileFlag = 0 -> 기존꺼(text경로) / 1 -> 새로운거(file이니까 처리 필요)
    let image = req.body;
    const feedIdx = req.params.idx;

    if(fileFlag == 1 && (!image || image == null)){ // 이미지가 새로운 것이라면 s3에 업로드
        image = uploadImage("image");
    }

    const result = {
        success : false,
        message : ''
    };

    try{
        const sql = `UPDATE feed SET content = $1 AND image_url = $2 WHERE idx = $3 AND couple_idx = $4`
        const values = [content, feedIdx, coupleIdx]
        
        await executeSQL(conn, sql, values)
        // 1. 이미지추가만
        // 2. 이미지추가, 글 수정 (content=modify newPic=add delPic=x)
        // 3. 이미지 수정만 (content=x newPic=modify delPic=modify)
        // 4. 이미지 수정, 글 수정 (content=modify newPic=modify delPic=modify)

        // 이미지 삭제도 있나? 
        // 5. 이미지 삭제만 (content=x newPic=x delPic=delete) 
        // 6. 이미지 삭제, 글 수정 (content=modify newPic=x delPic=delete)

        // 수정 성공시
        result.success = true;
        result.message = `idx가 ${feedIdx}인 피드 수정 성공`;
        res.status(200).send(result);

    }catch(e){
        next(e);
    }
})

// 5. delete feed/:idx 특정 피드 삭제하기
router.delete("/:idx", isLogin,  async(req, res, next) => {
    const {coupleIdx} = req.user;
    const feedIdx = req.params.idx;

    const result = {
        success : false,
        message : '',
    };

    try{
        // const sql = "UPDATE feed SET is_delete = true WHERE idx = $1 AND couple_idx = $2";
        const sql = "DELETE FROM feed WHERE idx = $1 AND couple_idx = $2"
        const values = [feedIdx, coupleIdx];
        await executeSQL(conn, sql, values);

        // 피드 soft delete 성공시
        result.success = true;
        result.message = `idx가 ${feedIdx}인 feed soft delete 성공`;
    }catch(e){
        next(e);
    }
})

module.exports = router
