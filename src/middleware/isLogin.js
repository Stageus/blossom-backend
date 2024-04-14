const jwt = require("jsonwebtoken");

const isLogin = (req, res, next, coupleIdx = null) => {
    const authorizationHeader = req.headers.authorization;
    try {
        if (!authorizationHeader) {
            throw new Error("no token");
        }

        const token = authorizationHeader.split(' ')[1]; 
        console.log("토큰: ", token)
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded; 

        if (coupleIdx) {
            if(!req.user.coupleIdx){
                throw new Error("invalid couple idx");
            }
        }

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
        } else if (err.message === "invalid couple idx") {
            result.message = "couple 연결 되어있지 않음";
        } else {
            result.message = "오류 발생";
        }

        res.status(401).json(result);
    }
};


module.exports = isLogin;