const client = require("../config/mongodb");

const makeLog = async (req, res, logData) => {
    try {
        const db = await client();
        const logHistory = db.collection("log");
        await logHistory.insertOne(logData);
        console.log("MongoDB insertion complete");
    } catch (error) {
        console.log("MongoDB insertion fail");
        console.error(error.stack);
    }
};

module.exports = makeLog;