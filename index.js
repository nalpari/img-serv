const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const { v4 } = require("uuid");
const fs = require("fs").promises;

const { cropImage } = require("cropify");
const sharp = require("sharp");

const app = express();
const port = 4000;

/**
 * 파일 업로드를 수행할 외부 서버
 */

// Multer 설정: 업로드된 파일을 'uploads/' 폴더에 저장
// const upload = multer({ dest: 'uploads/' });
// 사용자 정의 스토리지 엔진 생성
const storage = multer.diskStorage({
  // 파일이 저장되는 위치를 설정 (file: 업로드된 파일의 정보, cb: 콜백 함수)
  destination: (req, file, cb) => {
    // 업로드 폴더 경로 지정
    const uploadPath = "public/uploads/";

    // 폴더가 없으면 폴더를 생성
    // if (!fs.existsSync(uploadPath)) {
    //   fs.mkdirSync(uploadPath);
    // }

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
      // req.params.currentCanvasPlanId +  path.extname(file.originalname)
      v4() + path.extname(file.originalname)
      // file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// 파일 확장자 필터 정의
const fileFilter = (req, file, cb) => {
  // 허용되는 파일 확장자
  const allowedFileTypes = [".jpg", ".jpeg", ".png", ".gif", ".bmp"];

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
app.use(bodyParser.json()); // json 등록
app.use(bodyParser.urlencoded({ extended: false })); // URL-encoded 등록
app.use(cors()); // CORS 미들웨어 등록

app.get("/", (req, res) => {
  res.send("Hello World");
});

const checkArea = (obj) => {
  const { width, height, left, top } = obj;

  if (left < 0 || top < 0 || width > 1600 || height > 1000) {
    return false;
  }

  return true;
};

// '/upload' 라우트를 설정하고 multer 미들웨어를 사용
// multer의 upload.single('file') 함수로 'file' 이라는 이름의 단일 파일 처리
/**
 * 싱글파일 업로드시
 * 일반 이미지 파일 업로드시 uploads 폴더로 저장
 */
app.post("/image/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("파일이 업로드되지 않았습니다.");
    }

    const uploadedFilePath = path.join(
      __dirname,
      "public",
      "uploads",
      req.file.filename
    );

    // 파일 접근 가능 여부 확인
    try {
      const interval = setInterval(() => {
        console.log("check file");
        if (!fs.access(uploadedFilePath, fs.constants.F_OK)) {
          console.log("File does not exist:", uploadedFilePath);
        } else {
          clearInterval(interval);
        }
      }, 1000);

      const result = {
        filePath: `/uploads/${req.file.filename}`,
      };

      res.status(200).send(result);
    } catch (error) {
      console.error("업로드된 파일 접근 실패:", error);
      res.status(500).send("파일 업로드 후 접근 확인 실패");
    }
  } catch (error) {
    console.error("파일 업로드 에러:", error);
    res.status(500).send("파일 업로드 중 오류가 발생했습니다.");
  }
});

/**
 * cad 파일 업로드시
 * .dwg 파일을 .png 파일로 변환하여 cads 폴더에 저장
 */
app.post("/cad/convert", async (req, res) => {
  const files = req.body.Files;

  const FILE_PATH = "public/cads";
  try {
    await fs.readdir(FILE_PATH);
  } catch {
    await fs.mkdir(FILE_PATH);
  }
  fs.writeFile(
    `${FILE_PATH}/${files[0].FileName}.png`,
    files[0].FileData,
    "base64"
  );

  const result = {
    filePath: `/cads/${files[0].FileName}.png`,
  };

  res.status(200).send(result);
});

/**
 * canvas 이미지 저장
 * 도면을 binary 형식으로 받고 도면 내용에 맞게 crop 한 후 .png 파일로 Drawing 폴더에 저장
 */
app.post("/image/canvas", upload.single("file"), async (req, res) => {
  const { objectNo, planNo, type, width, height, left, top } = req.body;
  console.log("objectNo: ", objectNo);
  console.log("planNo: ", planNo);
  console.log("type: ", type);
  console.log("width: ", width);
  console.log("height: ", height);
  console.log("left: ", left);
  console.log("top: ", top);

  const FILE_PATH = "public/Drawing";
  try {
    await fs.readdir(FILE_PATH);
  } catch {
    await fs.mkdir(FILE_PATH);
  }

  const uploadedFilePath = path.join(
    __dirname,
    "public",
    "uploads",
    req.file.filename
  );
  console.log("🚀 ~ app.post ~ uploadedFilePath:", uploadedFilePath);
  console.log(`public/uploads/${req.file.filename}`);
  const imagePath = `public/uploads/${req.file.filename}`;

  try {
    const metadata = await sharp(imagePath).metadata();
    console.log("🚀 ~ app.post ~ metadata:", metadata);

    const checkResult = checkArea({ width, height, left, top });
    if (!checkResult) {
      await sharp(imagePath).toFile(
        `${FILE_PATH}/${objectNo}_${planNo}_${type}.png`
      );
    } else {
      await sharp(imagePath)
        .extract({
          width: parseInt(width),
          height: parseInt(height),
          left: parseInt(left),
          top: parseInt(top),
        })
        .toFile(`${FILE_PATH}/${objectNo}_${planNo}_${type}.png`);
    }
  } catch (err) {
    console.log("err: ", err);
  }

  fs.rm(imagePath);

  res.status(200).send("ok");
});

/**
 * 구글 맵 이미지 저장
 * 구글 맵 api 호출하여 .png 파일로 maps 폴더에 저장
 */
app.get("/map/convert", async (req, res) => {
  const API_KEY = "AIzaSyDO7nVR1N_D2tKy60hgGFavpLaXkHpiHpc";
  const { q, fileNm, zoom } = req.query;

  const targetUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=${zoom}&maptype=satellite&size=640x640&scale=1&key=${API_KEY}`;
  const decodeUrl = decodeURIComponent(targetUrl);

  const response = await fetch(decodeUrl);
  const data = await response.arrayBuffer();
  const buffer = Buffer.from(data);

  const FILE_PATH = "public/maps";
  try {
    await fs.readdir(FILE_PATH);
  } catch {
    await fs.mkdir(FILE_PATH);
  }
  fs.writeFile(`${FILE_PATH}/${fileNm}.png`, buffer);

  const result = {
    filePath: `/maps/${fileNm}.png`,
  };

  res.status(200).send(result);
});

/**
 * 서버 실행
 */
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
