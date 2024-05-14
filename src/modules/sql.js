const conn = require("../config/postgresql")

async function executeSQL(conn, sql, values) {
    try {
        const result = await conn.query(sql, values);
        return result.rows;
    } catch (error) {
        console.log(error.message);
        throw error;
    }
}

module.exports = { executeSQL };