const checkPattern = (pattern, item) => (req, res, next) => {
    try {
        let value = req.body[item];

        if (!pattern.test(value)) {
            const error = new Error(`${item} 입력 양식 오류`);
            error.status = 400;
            throw error;
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = checkPattern;