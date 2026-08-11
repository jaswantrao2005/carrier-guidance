const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/recordings');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    // Default to .webm if extension is missing, since MediaRecorder blobs often lack it in the originalname
    const ext = path.extname(file.originalname) || '.webm';
    const base = path.basename(file.originalname, ext) || 'recording';
    cb(null, `${timestamp}-${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Allow webm and mp4, also sometimes blobs are sent as 'video/x-matroska' or 'application/octet-stream' depending on browser
  if (
    file.mimetype === 'video/webm' || 
    file.mimetype === 'video/mp4' ||
    file.mimetype === 'video/x-matroska' ||
    file.mimetype === 'application/octet-stream' // fallback for some browsers
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only webm or mp4 video files are allowed.'));
  }
};

const videoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max for videos
  },
});

module.exports = videoUpload;
