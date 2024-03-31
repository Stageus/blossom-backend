async function logRequest(req, res, next) {
    const logData = {
        ip: req.ip,
        userId: req.userId,
        apiName: req.originalUrl,
        restMethod: req.method,
        inputData: req.body,
        time: new Date(),
    };

    await makeLog(req, res, logData, next);
}

module.exports = logRequest;
