// const { S3Client } = require('@aws-sdk/client-s3');
// const { fromIni } = require('@aws-sdk/credential-provider-ini');
const AWS = require("aws-sdk");

// const s3 = new S3Client({
//     region: process.env.S3_REGION,
//     credentials: fromIni({ profile: 'default' }) // 프로파일 이름 설정
//   });

AWS.config.update({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION
})

const s3 = new AWS.S3();
// aws-cli (aws configure)에서 accesskey랑 secret key설정해줌
// fromIni가 거기서 accesskey랑 secret key 가져와줌 (v3)

//npm install @aws-sdk/client-s3 @aws-sdk/credential-provider-ini

module.exports = { s3 }