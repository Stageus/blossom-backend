const conn = require("../config/postgresql")

async function executeSQL(conn, sql, values) {
    try {
        const result = await conn.query(sql, values);
        return result.rows;
    } catch (error) {
        console.log(error.message);
        throw new Error("SQL 통신 에러: " + error.message);
    }
}

module.exports = { executeSQL };