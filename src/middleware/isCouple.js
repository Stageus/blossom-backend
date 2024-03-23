const jwt = require("jsonwebtoken");

const isCouple = (req, res, next) => {
    const user = req.user;
    try {
        if (!user.coupleIdx) {
            throw new Error("no couple Idx");
        }

        next();

    } catch (err) {
        const result = {
            success: false,
            message: ""
        };

        if (err.message === "no couple Idx") {
            result.message = "커플 연결 되어있지 않음, 연결 필요";
        } else if (err.message === "invalid couple idx") {
            result.message = "조작된 couple Idx";
        } else {
            result.message = "오류 발생";
        }

        res.status(401).json(result);
    }
};

module.exports = isCouple;