const jwt = require('jsonwebtoken');

async function regenerateToken(oldToken, coupleIdx) {
    const decoded = jwt.decode(oldToken);
    const newToken = jwt.sign(
        {
            ...decoded,
            coupleIdx: coupleIdx, 
        },
        process.env.SECRET_KEY,
        {
            expiresIn: '10m',
        }
    );
    return newToken;
}

module.exports = regenerateToken;