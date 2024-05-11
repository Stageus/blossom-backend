const checkPattern = (pattern, item) => (req, res, next) => {
    try {
        let value = req.body[item];

        if (!pattern.test(value)) {
            const error = new Error(`${item} 입력 양식 오류`);
            error.status = 400;
            throw error;
        }
        console.log("입력 양식 확인 완료. 오류 없음.")

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = checkPattern;