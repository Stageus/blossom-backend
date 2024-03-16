const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3 } = require("../config/s3");

// npm install multer multer-s3

const maxFileSize = 5 * 1024 * 1024;

const uploadImage = (name) => {
    return multer({
        storage: multerS3({
            s3: s3,
            bucket: process.env.BUCKET_NAME,
            contentType: multerS3.AUTO_CONTENT_TYPE,
            acl: "public-read",
            key: function (req, file, cb) {
                const timestamp = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 12);
                cb(null, `${timestamp}_${file.originalname}`);
            }
        }),

        limits: { fileSize: maxFileSize },

        fileFilter: (req, file, cb) => {
            if (file.size > maxFileSize) {
                cb(new Error("파일 크기가 너무 큽니다. 최대 5MB까지 업로드 가능합니다."));
                return;
            }
            cb(null, true);
        }
    }).single(name);
};

module.exports = { uploadImage };