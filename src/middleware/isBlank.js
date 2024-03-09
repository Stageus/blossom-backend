const isBlank = (...items) => {
    return (req, res, next) => {
        const blank = [];
        console.log("빈칸 미들웨어")
        items.forEach(item => {
            // req.body 또는 req.file에서 해당 필드가 누락되었는지 체크
            if (!req.body[item] && !req.file[item]) {
                blank.push(item);
            }
        });

        if (blank.length > 0) {
            return next({
                message: `필수 항목인 [${blank.join(', ')}]이(가) 누락되었습니다.`,
                status: 400
            });
        }

        next();
    };
};

module.exports = isBlank;