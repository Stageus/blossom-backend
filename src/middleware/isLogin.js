const jwt = require("jsonwebtoken");

const isLogin = (req, res, next) => {
    const authorizationHeader = req.headers.authorization;
    
    try {
        if (!authorizationHeader) {
            throw new Error("no token");
        }

        const token = authorizationHeader.split(' ')[1]; 
        console.log("토큰: ", token)
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        console.log("해석: ", decoded)

        req.user = decoded; 

        // note : 로그인 할 때마다 coupleIdx를 확인할 수 없음. 따로 미들웨어를 만들어야 하지 않는가? 이건 db에서 가져오는 게 아니고
        // 토큰을 해석해오는 것이니까

        // if (coupleIdx&&!req.user.coupleIdx) {
        //     throw new Error("invalid couple idx");
        // }

        console.log("isLogin 완료. 다음 미들웨어로 진행.")

        next();
        

    } catch (err) {
        const result = {
            success: false,
            message: ""
        };

        if (err.message === "no token") {
            result.message = "token이 없음";
        } else if (err.message === "jwt expired") {
            result.message = "token 끝남";
        } else if (err.message === "invalid token") {
            result.message = "token 조작됨";
        } else {
            result.message = "오류 발생";
        }

        res.status(401).json(result);
    }
};


module.exports = isLogin;