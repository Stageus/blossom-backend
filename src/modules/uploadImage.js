function uploadFileToS3(req, res, next) {
    const upload = multer({
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

    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: "파일 업로드에 실패했습니다." });
        } else if (err) {
            return res.status(500).json({ message: "서버 오류" });
        }
        next();
    });
}

module.exports = uploadFileToS3;
