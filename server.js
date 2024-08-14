const express = require('express');
const mysql = require('mysql');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'icon-angka')));

app.set("view engine", "ejs");
app.set("views", "views");

const db = mysql.createConnection({
    host: "localhost",
    database: "flipbook",
    user: "root",
    password: "",
});

function bufferToBase64(buffer) {
    return Buffer.from(buffer).toString('base64');
}

const connectToDatabase = async () => {
    return new Promise((resolve, reject) => {
        db.connect((err) => {
            if (err) return reject(err);
            console.log("Database connected...");
            resolve();
        });
    });
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.get('/', async (req, res) => {
    try {
        const sql = "SELECT * FROM poster";
        db.query(sql, (err, result) => {
            if (err) throw err;
            const users = JSON.parse(JSON.stringify(result));
            const usersWithBase64Images = users.map(user => ({
                ...user,
                gambar: `data:image/jpeg;base64,${bufferToBase64(user.gambar.data)}`
            }));
            res.render('index', { title: 'User Images', users: usersWithBase64Images });
        });
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

app.get('/year/:year', async (req, res) => {
    try {
        const year = req.params.year;
        const sql = "SELECT * FROM poster WHERE tahun = ?";
        db.query(sql, [year], (err, result) => {
            if (err) throw err;
            const users = JSON.parse(JSON.stringify(result));
            const usersWithBase64Images = users.map(user => ({
                ...user,
                gambar: `data:image/jpeg;base64,${bufferToBase64(user.gambar.data)}`
            }));
            res.json(usersWithBase64Images);
        });
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

app.post('/upload', upload.single('gambar'), async (req, res) => {
  const { nim, nama, tahun } = req.body;
  const gambar = req.file;

  try {
      let buffer = fs.readFileSync(gambar.path);
      let sharpImage = sharp(buffer);
      const metadata = await sharpImage.metadata();

      // Resize gambar jika terlalu besar
      if (metadata.width > 2000) {
          sharpImage = sharpImage.resize({ width: 2000 });
      }

      let compressedBuffer;
      let quality = 80; // Mulai dari kualitas 80

      // Kompresi hingga ukuran di bawah 500 KiB
      while (quality > 0) {
          compressedBuffer = await sharpImage
              .jpeg({ quality, mozjpeg: true })
              .toBuffer();
          if (compressedBuffer.length <= 500 * 1024) {
              buffer = compressedBuffer;
              break;
          }
          quality -= 10;
      }

      const sql = "INSERT INTO poster (nim, nama, tahun, gambar) VALUES (?, ?, ?, ?)";
      db.query(sql, [nim, nama, tahun, buffer], (err, result) => {
          if (err) {
              console.error(err);
              res.status(500).send('Error uploading data');
              return;
          }
          res.redirect('/');
      });
  } catch (err) {
      console.error(err);
      res.status(500).send('Error processing image');
  }
});


app.listen(8000, () => {
    console.log("server ready...");
});
