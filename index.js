// 필요한 모듈을 불러옵니다.
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 4000;

// Multer 설정: 업로드된 파일을 'uploads/' 폴더에 저장
// const upload = multer({ dest: 'uploads/' });
// 사용자 정의 스토리지 엔진 생성
const storage = multer.diskStorage({
  // 파일이 저장되는 위치를 설정 (file: 업로드된 파일의 정보, cb: 콜백 함수)
  destination: (req, file, cb) => {
    // 업로드 폴더 경로 지정
    const uploadPath = "uploads/";

    // 폴더가 없으면 폴더를 생성
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }

    // 콜백 함수를 호출하여 업로드 경로를 전달
    cb(null, uploadPath);
  },

  // 저장할 파일 이름 지정
  filename: (req, file, cb) => {
    // 콜백 함수를 호출하여 변경된 파일 이름을 전달
    // file.fieldname: 폼 필드의 이름, Date.now(): 현재 시간 (밀리초), path.extname(file.originalname): 원본 파일의 확장자
    // 파일 이름 예: file-1633959266884.jpg
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// 파일 확장자 필터 정의
const fileFilter = (req, file, cb) => {
  // 허용되는 파일 확장자
  const allowedFileTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];

  // 파일의 확장자와 허용된 확장자를 비교
  if (allowedFileTypes.includes(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type")); // 유효하지 않은 파일 형식
  }
};

// Multer 설정: 사용자 정의 스토리지를 설정하고 파일 크기 제한 및 파일 필터링 적용
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB 크기 제한
  fileFilter: fileFilter,
});

// 정적 파일을 제공할 디렉토리를 설정
app.use(express.static("public"));

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World");
});

// '/upload' 라우트를 설정하고 multer 미들웨어를 사용
// multer의 upload.single('file') 함수로 'file' 이라는 이름의 단일 파일 처리
app.post("/image/upload", upload.single("file"), (req, res) => {
  // console.log(`File uploaded: ${req.file.originalname}`);
  console.log("file upload");

  res.status(200).send("File uploaded successfully.");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
