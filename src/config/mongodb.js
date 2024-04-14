const { MongoClient } = require('mongodb');

const connectToMongo = async () => {
    const client = new MongoClient("mongodb://localhost:27017");

    try {
        await client.connect();
        console.log('Connected to MongoDB');
        return client.db("blossom");
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
};

async function loggingMiddleware(req, res, next) {
    try {
            const db = await connectToMongo();
        
            const { ip, originalUrl, method } = req;
            const allInput = { ...req.body, ...req.params, ...req.query}
            const timestamp = new Date();
            

            let outputData = null;
            res.on('finish', async() => {
                    outputData = res.locals.result; // locals - 미들웨어간 데이터 전달하는데 사용되는 저장소 (요청<->응답 데이터 공유)
                    // 에러 발생했을 경우 기록
                    const error = res.locals.error;
                    if(error){
                        const errorLog = {
                            errorMessage: error.message,
                            stackTrace : error.stack,
                            loggingTime : new Date()
                        }
                        await db.collection('logs').insertOne(errorLog)
                        console.log("에러로그 mongoDB에 저장")
                    }

                    const log = {
                        ip: ip,
                        id: (req.user && req.user.id) || req.body.id, // id
                        apiName : originalUrl,
                        restMethod : method,
                        input : allInput,
                        output : outputData, // API 실행 후에 설정할 수 있음
                        loggingTime: timestamp
                    };
                
                    // logging database -> logs collection에 로그 저장
                    await db.collection('logs').insertOne(log);
                    console.log('API 호출에 대한 로그가 MongoDB에 저장되었습니다.');
            });
     
    } catch (err) {
      console.error('로그 생성 중 오류:', err);
    }
  
    next();
  }

module.exports = {loggingMiddleware, connectToMongo};