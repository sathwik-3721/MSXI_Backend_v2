const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pdfRoutes = require('./src/routes/pdfRoutes');
const imageRoutes = require('./src/routes/imageRoutes');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// import routes
app.use('/pdf', pdfRoutes);
app.use('/image', imageRoutes);

app.listen(3002, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:3002`);
});