const jwt = require("jsonwebtoken");

const isLogin = (req, res, next) => {
    //cookie 를 제거하고 직접 토큰을 FE에게 보내는 식으로 변경.
    const authorizationHeader = req.headers.authorization;
    try {
        if (!authorizationHeader) {
            throw new Error("no token");
        }

        const token = authorizationHeader.split(' ')[1]; // "Bearer <token>" 형태에서 <token> 부분 추출
        console.log("토큰: ", token)
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded; // 디코딩된 사용자 정보를 req.user에 추가

        // 다음 미들웨어로 계속 진행
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

        res.status(401).json(result); // 에러 응답을 JSON 형태로 전송
    }
};

module.exports = isLogin;