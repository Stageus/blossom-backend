const jwt = require('jsonwebtoken');

// 토큰 발급 및 재발급 함수
async function generateToken(user, coupleIdx = 0) {
    console.log("coupleIdx: ", coupleIdx)
    try {
        const token = jwt.sign(
            {
                id: user.id,
                idx: user.idx,
                coupleIdx: coupleIdx,
                isadmin: user.isadmin,
            },
            process.env.SECRET_KEY,
            {
                issuer: user.id,
                expiresIn: '10m' // 테스트용! 실제로는 나중에 수정할 것
            }
        );
        console.log("재발행 token: ", token)
        return token;
    } catch (error) {
        throw new Error('토큰 생성 오류: ' + error.message);
    }
}

module.exports = generateToken;
