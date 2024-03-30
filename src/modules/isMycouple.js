const conn = require("../config/postgresql")
const { executeSQL } = require("./sql")

const isMycouple = async(req, res, next) =>{
    try {
        let coupleIdx = req.body[coupleIdx];
        let contentIdx = req.params[idx];

        const sql = "SELECT couple_idx FROM schedule WHERE idx = $1 AND is_delete = false";
        const values = [contentIdx];

        const dbResult = await executeSQL(conn, sql, values);

        if(dbResult.length == 0){
            const error = new Error(`${contentIdx}번째 컨텐츠가 존재하지 않습니다.`)
            error.status = 404;
            throw error;
        }

        if(dbResult[0].couple_idx != coupleIdx){
            const error = new Error("본인 커플의 컨텐츠가 아닙니다. 접근 권한이 존재하지 않습니다");
            error.status = 403;
            throw error;
        }
        
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = { isMycouple };