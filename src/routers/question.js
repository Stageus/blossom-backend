const router = require("express").Router();
const isLogin = require('../middleware/isLogin');
const queryConnect = require('../modules/queryConnect');
const makeLog = require("../modules/makelog");
const isBlank = require("../middleware/isBlank")
const redis = require("redis").createClient();

// 문답 목록 불러오기 API
router.get("/", isLogin, async (req, res, next) => {
    const userId = req.user.id;  
    const coupleIdx = req.user.coupleIdx;
    const result = {
        success: false,
        message: "",
        data: null
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
        };
        
        const { rows } = await queryConnect(query);
        result.data.posts = rows

        result.success = true;
        result.message = "게시물 불러오기 성공";    
        const logData = {
            ip: req.ip,
            userId,  
            apiName: '/post', 
            restMethod: 'GET', 
            inputData: {}, 
            outputData: result, 
            time: new Date(), 
        };

        await makeLog(req, res, logData, next);    
        res.send(result);
    } catch (error) {
        console.error('게시물 불러오기 오류: ', error);
        result.message = "게시물 불러오기 실패";
        return next(error);
    }
});

// 게시물 검색하기 
router.get("/search", isLogin, async (req, res, next) => {
    const userIdx = req.user.idx
    const userId = req.user.id
    const { title } = req.query
    const time = new Date() //timestamp
    const result = {
        "message": "",
        "data": {
            "searchPost": null,
        }
    }
    try {
        await redis.connect()
        redis.ZADD(`recent${userIdx}`, { //Sorted Set에 멤버를 추가하고 해당 멤버에 대한 점수를 설정 - 시간으로 score 설정해서 정렬하기 위함

            score: time.getTime(),
            value: title
        })
        await redis.EXPIRE(`recent${userIdx}`, 86400) //지정된 키의 만료 시간을 설정 만료 시간이 지나면 키는 자동으로 삭제

        const query = {
            text: `
                SELECT 
                    post.title, 
                    post.content, 
                    post.created_at, 
                    account.id AS postingUser
                FROM 
                    post
                JOIN 
                    account ON post.account_idx = account.idx
                WHERE 
                    post.title ILIKE $1
                ORDER BY 
                    post.created_at DESC
            `,
            values: [`%${title}%`],
        };
        const {rowCount, rows}= await queryConnect(query);
        console.log("결과: ",rowCount)
        console.log("rows: ",rows)
        if (rowCount == 0) {
            result.message = "게시물 없음."
        } else {
            result.data.searchPost = rowCount
            result.message = rows;
        }
        const logData = {
            ip: req.ip,
            userId: userId,
            apiName: '/post/search',
            restMethod: 'GET',
            inputData: { userId },
            outputData: result,
            time: new Date(),
        };

        makeLog(req, res, logData, next);
        return res.status(200).send(result);
    } catch (error) {
        next(error)
    } finally {
        await redis.disconnect()
    }
})

// 최근 검색어 5개 출력 API 
router.get("/recent", isLogin, async (req, res, next) => {
    const userIdx = req.user.idx;
    const userId = req.user.id

    const result = {
        success: false,
        message: "",
        data: null,
    };

    try {
        await redis.connect();

        const recentSearch = await redis.ZRANGE(`recent${userIdx}`, -5, -1);//ZRANGE (Sorted Set에서 범위를 가져오기), 매개변수로 rev 주게 됨
        console.log("검색기록: ", recentSearch);

        if (recentSearch.length === 0) {
            result.message = "최근 검색기록 없음.";
            return res.status(200).send(result);
        }

        result.success=true
        result.data = recentSearch.reverse();
        await redis.EXPIRE(`recent${userIdx}`, 86400); // 24시간

        const logData = {
            ip: req.ip,
            userId: userId,
            apiName: '/post/recent',
            restMethod: 'GET',
            inputData: { userId },
            outputData: result,
            time: new Date(),
        };

        makeLog(req, res, logData, next);
        res.status(200).send(result);
    } catch (error) {
        next(error);
    } finally {
        await redis.disconnect();
    }
});

// 게시물 불러오기 API
router.get("/:postIdx", isLogin, async (req, res, next) => {
    const postIdx = req.params.postIdx;
    const userId = req.user.id;

    const result = {
        success: false,
        message: "",
        data: null,
    };
    try {
        const query = {
            text: ` SELECT 
                        post.*, 
                        account.id AS account_id
                    FROM 
                        post
                    JOIN 
                        account ON post.account_idx = account.idx
                    WHERE 
                        post.idx = $1;`,
            values: [postIdx],
        };
        const { rows } = await queryConnect(query);
        if (rows.length == 0) {
            return next({
                message: '게시물 불러오기 실패',
                status: 500
            });
        } 

        const post = rows
        result.success = true;
        result.data = post; 
        
        const logData = {
            ip: req.ip,
            userId,  
            apiName: '/post:/postIdx', 
            restMethod: 'GET', 
            inputData: {}, 
            outputData: result, 
            time: new Date(), 
        };

        await makeLog(req, res, logData, next);
        res.send(result);
    } catch (error) {
        console.error('게시물 가져오기 오류 발생: ', error.message);
        result.message = error.message;
        return next(error);
    }
});

// 게시물 쓰기 API - 여러 개 업로드 가능 - 5개 이상 이미지 줄때 예외처리
router.post("/", isLogin, upload.array("file", 5), isBlank('content', 'title'), async (req, res, next) => {
    const userIdx = req.user.idx;
    const userId = req.user.id;
    const { content, title } = req.body;
    const files = req.files;
    const result = {
        success: false,
        message: "",
        data: null
    };
    console.log("파일들: ",files)
    try {
        let imageIdxArray = [];

        // 파일 업로드가 성공하면 해당 파일의 S3 URL을 가져와서 DB에 저장
        if (files && files.length > 0) {
            for (const file of files) {
                const imageUrl = file.location;

                // 이미지 테이블에 이미지 저장
                const imageInsertQuery = {
                    text: 'INSERT INTO image (image_url) VALUES ($1) RETURNING idx',
                    values: [imageUrl]
                };

                const imageResult = await queryConnect(imageInsertQuery);
                const imageIdx = imageResult.rows[0].idx;

                imageIdxArray.push(imageIdx);
            }
        }

        // 포스트 테이블에 게시물 등록
        const postInsertQuery = {
            text: 'INSERT INTO post (title, content, account_idx) VALUES ($1, $2, $3) RETURNING idx',
            values: [title, content, userIdx]
        };

        const postResult = await queryConnect(postInsertQuery);
        const postIdx = postResult.rows[0].idx;

        // post_image 테이블에 이미지와 포스트 연결 정보 저장
        for (let i = 0; i < imageIdxArray.length; i++) {
            const imageIdx = imageIdxArray[i];
            const order = i + 1; // 1부터 시작하도록 순차적으로 order 부여
        
            const postImageInsertQuery = {
                text: 'INSERT INTO post_image (post_idx, image_idx, image_order) VALUES ($1, $2, $3)',
                values: [postIdx, imageIdx, order]
            };
        
            await queryConnect(postImageInsertQuery);
        }
        

        result.success = true;
        result.message = "게시물 등록 성공";
        result.data = postResult.rowCount;

        const logData = {
            ip: req.ip,
            userId,
            apiName: '/post',
            restMethod: 'POST',
            inputData: { content, title, imageIdxArray },
            outputData: result,
            time: new Date(),
        };

        await makeLog(req, res, logData, next);
        res.send(result);

    } catch (e) {
        result.message = e.message;
        return next(e);
    }
});

// 게시물 수정하기 API
// flag 을 넣어서 0,1,2 => 숫자별로 의미를 부여
// post_image 테이블에서 image_url 추가하기
// s3랑 multer 합치기


router.put("/:postIdx", isLogin, upload.array("file", 5), isBlank('content', 'title'), async (req, res, next) => {
    const postIdx = req.params.postIdx;
    const userIdx = req.user.idx;
    const { content, title, newImageOrder, deleteImageUrl } = req.body; // 남은 이미지에 이미지 순서 하나하나 부여하기
    const files = req.files; //새로 추가할 이미지들
    let imageIdxArray = []; // 이미지 객체로 해서 순서와 idx 저장하기, 이후 이 개수가 5 이상이면 해당 idx 삭제
    // 문자열로 오는 경우, 쉼표로 구분된 숫자들을 배열로 변환
    const extractedNumbers = newImageOrder.split(',').map(order => parseInt(order, 10));
    console.log("extractedNumbers.length: ", extractedNumbers.length)
    const numberOfFiles = Object.keys(files).length;
    console.log(`파일 ${numberOfFiles} 개.`);

    const result = {
        success: false,
        message: "",
        data: null
    };

    for (let i = 0; i < extractedNumbers.length; i++) {
        console.log(`extractedNumbers[${i}]: `,extractedNumbers[i]);
    }

    if(extractedNumbers.length!==numberOfFiles){
        result.message = "추가하는 이미지 개수와 순서의 개수가 다릅니다"
        return res.send(result);
    }

    try {
        // 이전 게시물 정보 가져오기
        const getPostQuery = {
            text: 'SELECT * FROM post WHERE idx = $1 AND account_idx = $2',
            values: [postIdx, userIdx],
        };

        const { rows: [post] } = await queryConnect(getPostQuery);

        if (!post) {
            result.message = '게시물이나 권한이 없습니다.';
            // return res.send(result);
        }

        // 게시물에 있는 이미지 정보들 post_image에서 가져오기
        const getPostImagesQuery = {
            text: 'SELECT image_idx, image_order FROM post_image WHERE post_idx = $1 ORDER BY image_order',
            values: [postIdx],
        };
        const postImagesResult = await queryConnect(getPostImagesQuery);

        //게시물 이미지 순서에 맞게 map으로 정렬해서 가져오기 (map 함수를 사용하여 배열로 변환하고, 배열의 각 요소를 객체로 만듦)
        const imageIdxOrderArray = postImagesResult.rows.map(row => ({ idx: row.image_idx, order: row.image_order }));
        console.log("imageIdxOrderArray: ",imageIdxOrderArray)
        imageIdxArray.push(...imageIdxOrderArray);

        if (imageIdxOrderArray.length >= 5) {
            console.log("기존 이미지 5개 -> 더 이상 추가 못함 (삭제 전)");
            console.log("실행중 1.");
        }

        if(deleteImageUrl && deleteImageUrl.length>0){
            console.log("deleteImageUrl: ", deleteImageUrl);
            // deleteImageUrl을 배열로 변환하고 추가 문자를 제거.
            const deleteImageUrlArray = Array.isArray(deleteImageUrl)
            ? deleteImageUrl.map(url => url.trim())
            : [deleteImageUrl.trim()];
    
            console.log("deleteImageUrlArray: ", deleteImageUrlArray);
    
            if (deleteImageUrlArray.length > 0) {
                for (const deleteImageUrl of deleteImageUrlArray) {
                    console.log("실행중 2.");
                    console.log("deleteImageUrl: ", deleteImageUrl);

                    // deleteImageUrl에서 추가 문자를 제거.
                    const cleanedDeleteImageUrl = deleteImageUrl.trim();

                    // 삭제할 이미지의 S3 URL 가져오기 // 굳이 필요?
                    const getImageUrlQuery = {
                    text: 'SELECT idx FROM image WHERE image_url = $1',
                    values: [cleanedDeleteImageUrl],
                    };

                    console.log("실행중 3.");
                    const imageUrlResult = await queryConnect(getImageUrlQuery);

                    console.log("실행중 4.");
                    console.log("imageUrlResult.rows[0]: ", imageUrlResult.rows[0]);

                    if (imageUrlResult.rows[0]) {
                        const imageIdxToDelete = imageUrlResult.rows[0].idx;
                        console.log("imageIdxToDelete: ", imageIdxToDelete);
                        console.log("실행중 5.");
                        // 나머지 로직 계속 진행

                        // S3에서 이미지 삭제
                        const imageKey = cleanedDeleteImageUrl;
                        const decodedKey = decodeURIComponent(imageKey.split('/').pop());
                        console.log("이미지 키: ",imageKey, "디코드 키: ",decodedKey)
                        await s3.deleteObject({ Bucket: 'sohyunxxistageus', Key: `uploads/${decodedKey}` }).promise();

                        // post_image 및 image 테이블에서 이미지 삭제
                        const deleteImageQuery = {
                            text: 'DELETE FROM post_image WHERE post_idx = $1 AND image_idx = $2',
                            values: [postIdx, imageIdxToDelete],
                        };
                        await queryConnect(deleteImageQuery);

                        const deleteImageInfoQuery = {
                            text: 'DELETE FROM image WHERE idx = $1',
                            values: [imageIdxToDelete],
                        };
                        await queryConnect(deleteImageInfoQuery);

                        //기존에 존재하는 이미지 배열에서도 pop
                        const indexToDelete = imageIdxArray.findIndex(item => item.image_idx === imageIdxToDelete);
                        if (indexToDelete !== -1) {
                            imageIdxArray.splice(indexToDelete, 1);
                        }

                    } else {
                        console.log("deleteImageUrl에 대한 이미지를 찾을 수 없습니다:", cleanedDeleteImageUrl);
                        result.message="deleteImageUrl에 대한 이미지를 찾을 수 없습니다:";
                        //return res.send(result);
                    }
                } //반복문 종료
    
                // 삭제하고 남은 이미지 조회
                const getOriginalImageUrlQuery = {
                    text: 'SELECT image_idx, image_order FROM post_image WHERE post_idx = $1',
                    values: [postIdx],
                };
                const originalImageUrlResult = await queryConnect(getOriginalImageUrlQuery);

                console.log("삭제하고 남은 이미지 조회: ",originalImageUrlResult)

                // 남은 이미지 - 이미지 객체를 생성하고 배열에 추가 - idx, order 순
                const remainingImages = originalImageUrlResult.rows.map(imageInfo => ({
                    idx: imageInfo.image_idx,
                    order: imageInfo.image_order,
                }));

                // 기존에 존재하는 이미지 배열에서 제거
                imageIdxArray = remainingImages.slice();

                console.log("삭제하고 남은 배열 조회: ", imageIdxArray)
                
             
            }
        }
        // 새로운 이미지 추가하기
        if (files && files.length > 0) {
            // 이미지 개수 조회 쿼리 
            const getImageCountQuery = {
                text: 'SELECT COUNT(*) AS image_count FROM post_image WHERE post_idx = $1',
                values: [postIdx],
            };

            const imageCountResult = await queryConnect(getImageCountQuery);
            const imageCount = imageCountResult.rows[0].image_count;

            if (imageCount >= 5) {
                console.log("이미지 배열이 다 차서 더 이상 이미지를 추가할 수 없습니다.");
            } else {
                for (const [i, file] of files.entries()) {
                    console.log("진입 완료")
                    const imageUrl = file.location;
                    console.log("imageUrl: ", imageUrl)

                    // 이미지 테이블에 이미지 저장
                    const imageInsertQuery = {
                        text: 'INSERT INTO image (image_url) VALUES ($1) RETURNING idx',
                        values: [imageUrl]
                    };
    
                    const imageResult = await queryConnect(imageInsertQuery);
                    const imageIdx = imageResult.rows[0].idx;

                    console.log(extractedNumbers)
                    
                    console.log("문제2");
                    console.log("imageIdxArray: ", imageIdxArray);
                    
                    const existingImage = imageIdxArray.find(item => item.order === extractedNumbers[i]); // 수정된 부분
                    console.log("문제2");

                    console.log("extractedNumbers[i]: ",extractedNumbers[i]);

                    
                    console.log("중복된 순서의 이미지: ",existingImage)
                    
                    if (existingImage) {
                        console.log("문제4-중복이미지")
                        //새로추가하는 이미지랑 원래 기존에 있던 이미지 순서가 겹치는 경우
                        console.log("imageIdxArray: ", imageIdxArray)

                        // 추가된 이미지의 뒤에 있는 이미지들의 image_order 조정 - if문 이후에?
                        const checkImageOrderQuery = {
                            text: 'UPDATE post_image SET image_order = image_order + 1 WHERE post_idx = $1 AND image_order > $2',
                            values: [postIdx, extractedNumbers[i]],
                        };

                        await queryConnect(checkImageOrderQuery);
                        console.log("imageIdxArray: ", imageIdxArray)

                        console.log("문제6")
                        const updateImageOrderQuery = {
                            text: 'INSERT INTO post_image (post_idx, image_idx, image_order) VALUES ($1, $2, $3)',
                            values: [postIdx, imageIdx, extractedNumbers[i] + 1],
                        };
                        console.log("기존 order : ",extractedNumbers[i] ," 바뀌고 난 뒤의 order: ",extractedNumbers[i] + 1)
                        console.log("문제4")
    
                        await queryConnect(updateImageOrderQuery);
                        console.log("문제5")
                        console.log("문제7")

                        const imageObject = { // 넣지 말고 기다리기
                            idx: imageIdx,
                            order: extractedNumbers[i] + 1, // 이미지가 배열의 몇 번째인지로 순서를 할당
                        };
                        console.log("문제1")
                        imageIdxArray.push(imageObject);
    
                    } else {//겹치지 않는 경우 - 문제발생
                        // 새로운 이미지 추가 -> image 테이블, post_image 테이블
                        if(extractedNumbers[i]==0){//첫번째 자리에 이미지를 삽입할려고 하는 경우 -> 한칸씩 뒤로 미루기
                            const updateImageOrderQuery = {
                                text: 'UPDATE post_image SET image_order = image_order + 1 WHERE post_idx = $1 AND image_order > $2',
                                values: [postIdx, extractedNumbers[i]],
                            };
    
                            await queryConnect(updateImageOrderQuery);

                            const selectImageOrderQuery = {
                                text: 'SELECT * FROM post_image WHERE post_idx = $1',
                                values: [postIdx],
                            };
    
                            const selectResult = await queryConnect(selectImageOrderQuery);

                            console.log("순서 조정 후 결과: ", selectResult.rows[0])

                            const insertImageOrderQuery = {
                                text: 'INSERT INTO post_image (post_idx, image_idx, image_order) VALUES ($1, $2, $3)',
                                values: [postIdx, imageIdx, extractedNumbers[i]+1],
                            };
    
                            await queryConnect(insertImageOrderQuery);
                            console.log("문제7")
                            const imageObject = { // 넣지 말고 기다리기
                                idx: imageIdx,
                                order: extractedNumbers[i]+1, // 이미지가 배열의 몇 번째인지로 순서를 할당
                            };
                            console.log("문제1")
                            imageIdxArray.push(imageObject);
                        }else{
                            console.log("문제555")
                            const insertNewImageQuery = {
                                text: 'INSERT INTO post_image (post_idx, image_idx, image_order) VALUES ($1, $2, $3)',
                                values: [postIdx, imageIdx, extractedNumbers[i]],
                            };
                            console.log("문제6")
        
                            await queryConnect(insertNewImageQuery);
                            console.log("문제7")
                            const imageObject = { // 넣지 말고 기다리기
                                idx: imageIdx,
                                order: extractedNumbers[i], // 이미지가 배열의 몇 번째인지로 순서를 할당
                            };
                            console.log("문제1")
                            imageIdxArray.push(imageObject);
                        }
                    }
                }
            }            

        }
        console.log("imageIdxArray: ", imageIdxArray)

        //이미지의 총 개수가 5개 이상이 되는 경우, 5개 이후 이미지 삭제 - 이건 기존의 이미지임 - 후처리 말고 이미지 받을 때 처리하기
        if (imageIdxArray.length > 5) {
            const selectDeleteIdxQuery = {
                text:   `SELECT image_idx
                        FROM post_image
                        WHERE post_idx = $1
                        ORDER BY image_order ASC
                        OFFSET 5;
                        `,
                values:[postIdx]
            }

            const selectDeleteIdxResult = (await queryConnect(selectDeleteIdxQuery)).rows;
            console.log("selectDeleteIdxResult: ", selectDeleteIdxResult)

            for(let i = 0; i<selectDeleteIdxResult.length;i++){
                console.log("selectDeleteIdxResult[i]: ",selectDeleteIdxResult[i])
                console.log("selectDeleteIdxResult[i].idx: ",selectDeleteIdxResult[i].image_idx)
                
                const selectDeleteIdxQuery = {
                    text:   `SELECT image_url
                            FROM image
                            WHERE idx = $1
                            `,
                    values:[selectDeleteIdxResult[i].image_idx]
                }
                const imageUrlResult = await queryConnect(selectDeleteIdxQuery);

                console.log("Image URL:", imageUrlResult.rows[0].image_url);

                const imageKey = imageUrlResult.rows[0].image_url;
                const decodedKey = decodeURIComponent(imageKey.split('/').pop());
                console.log("이미지 키: ",imageKey, "디코드 키: ",decodedKey)
                await s3.deleteObject({ Bucket: 'sohyunxxistageus', Key: `uploads/${decodedKey}` }).promise();

                const deleteImageQuery = {
                    text: `DELETE FROM post_image
                            WHERE post_idx = $1
                            AND image_idx = $2 `,
                    values: [postIdx, selectDeleteIdxResult[i].image_idx],
                };
                
                await queryConnect(deleteImageQuery);

                const deletePostImagesQuery = {
                    text: `DELETE FROM image
                            WHERE idx = $1 `,
                    values: [selectDeleteIdxResult[i].image_idx],
                };
                
                await queryConnect(deletePostImagesQuery);

            }
        }

        // 게시물 수정 - 제목, 내용
        const updatePostQuery = {
            text: 'UPDATE post SET title = $1, content = $2 WHERE idx = $3 AND account_idx = $4',
            values: [title, content, postIdx, userIdx],
        };

        const { rowCount } = await queryConnect(updatePostQuery);

        if (rowCount > 0) {
            result.success = true;
            result.message = "업데이트 성공";
        } else {
            result.success = false;
            result.message = "게시물 업데이트 실패.";
        }

    } catch (e) {
        result.message = e.message;
    } finally {
        return res.send(result);
    }
});

// 게시물 삭제하기 API
router.delete("/:idx", isLogin, async (req, res, next) => {
    const postIdx = req.params.idx;
    const userIdx = req.user.idx;

    const result = {
        "success": false,
        "message": "",
        editable: false
    };

    try {
        // 해당 게시물이 존재하는지 확인
        const checkPostQuery = {
            text: 'SELECT * FROM post WHERE idx = $1 AND account_idx = $2',
            values: [postIdx, userIdx],
        };
        const { rows: [post] } = await queryConnect(checkPostQuery);

        if (!post) {
            result.message = '게시물이나 권한이 없습니다.';
            return res.send(result);
        }

        // post_image 테이블에서 연결된 이미지 정보 가져오기
        const getPostImageQuery = {
            text: 'SELECT image_idx FROM post_image WHERE post_idx = $1',
            values: [postIdx],
        };
        const postImageResult = await queryConnect(getPostImageQuery);
        console.log("postImageResult:  ", postImageResult)

        if (postImageResult.rows.length > 0) {
            // post_image에 연결된 이미지가 존재할 경우
            console.log("이미지 존재")
            const imageIdxArray = postImageResult.rows.map(row => row.image_idx);
            console.log("imageIdxArray: ", imageIdxArray)

            for (const imageIdx of imageIdxArray) {
                // post_image 테이블에서 이미지 정보 먼저 삭제
                console.log("반복문 진입")
                console.log("imageIdx: ", imageIdx)
                /// S3 버킷에서 이미지 삭제
                const getImageInfoQuery = {
                    text: 'SELECT * FROM image WHERE idx = $1',
                    values: [imageIdx],
                };
                const imageInfoResult = await queryConnect(getImageInfoQuery);
                console.log("imageInfoResult: ",imageInfoResult)
                if (imageInfoResult.rows.length > 0) {
                    console.log("if문 진입")
                    const imageKey = imageInfoResult.rows[0].image_url;
                    const decodedKey = decodeURIComponent(imageKey.split('/').pop());
                    console.log("이미지 키: ",imageKey, "디코드 키: ",decodedKey)
                    try {
                        await s3.deleteObject({ Bucket: 'sohyunxxistageus', Key: `uploads/${decodedKey}` }).promise();
                        console.log("S3에서 이미지 삭제 성공");
                    } catch (error) {
                        console.error("S3에서 이미지 삭제 실패:", error);
                    }
                }
                const deletePostImageQuery = {
                    text: 'DELETE FROM post_image WHERE post_idx = $1 AND image_idx = $2',
                    values: [postIdx, imageIdx],
                };
                await queryConnect(deletePostImageQuery);

                // 이후 image 테이블에서 이미지 삭제
                const deleteImageQuery = {
                    text: 'DELETE FROM image WHERE idx = $1',
                    values: [imageIdx],
                };
                await queryConnect(deleteImageQuery);

            }
        }

        // post 테이블에서 게시물 삭제
        const deletePostQuery = {
            text: `DELETE FROM post WHERE idx = $1 AND account_idx = $2`,
            values: [postIdx, userIdx],
        };

        const { rowCount } = await queryConnect(deletePostQuery);

        if (rowCount > 0) {
            result.editable = true;
            result.success = true;
            result.message = "게시물 삭제 성공";
        } else {
            result.message = '게시물 삭제 실패. 해당 게시물이나 권한이 없습니다.';
        }

    } catch (e) {
        result.message = e.message;
        return next(e);
    } finally {
        return res.send(result);
    }
});


module.exports = router