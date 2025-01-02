const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = 3000;

// เชื่อมต่อกับ MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((error) => {
  console.error('Error connecting to MongoDB Atlas', error);
});

// สร้างโมเดล
const ApiKey = mongoose.model('ApiKey', new mongoose.Schema({
  sheetId: String,
  sheetRange: String,
  apiKey: String,
}));

// สร้าง API เพื่อดึงข้อมูล
app.get('/api/get-api-details', async (req, res) => {
  try {
    const apiDetails = await ApiKey.findOne();  // ค้นหาจากฐานข้อมูล
    if (!apiDetails) {
      return res.status(404).send('No API details found');
    }
    res.json(apiDetails); // ส่งข้อมูลเป็น JSON
  } catch (error) {
    res.status(500).send('Error fetching data');
  }
});

// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
