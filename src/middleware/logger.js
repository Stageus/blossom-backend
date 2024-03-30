async function logRequest(req, res, next) {
    const logData = {
        ip: req.ip,
        userId: req.userId, // 이 부분은 사용자 식별 정보가 담긴 곳으로 바꿔야 합니다.
        apiName: req.originalUrl,
        restMethod: req.method,
        inputData: req.body,
        time: new Date(),
    };

    await makeLog(req, res, logData, next);
}

module.exports = logRequest;
