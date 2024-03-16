const { S3Client } = require('@aws-sdk/client-s3');
const { fromIni } = require('@aws-sdk/credential-provider-ini');

const s3 = new S3Client({
    region: process.env.S3_REGION,
    credentials: fromIni({ profile: 'default' }) // 프로파일 이름 설정
  });


// aws-cli (aws configure)에서 accesskey랑 secret key설정해줌
// fromIni가 거기서 accesskey랑 secret key 가져와줌 (v3)

//npm install @aws-sdk/client-s3 @aws-sdk/credential-provider-ini

module.exports = { s3 }