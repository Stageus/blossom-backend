const { MongoClient } = require('mongodb');

const connectToMongo = async () => {
    const client = new MongoClient("mongodb://localhost:27017");

    try {
        await client.connect();
        console.log('Connected to MongoDB');
        return client.db("week15");
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
};

module.exports = connectToMongo;