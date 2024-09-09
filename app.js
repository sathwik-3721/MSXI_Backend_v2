const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pdfRoutes = require('./src/routes/pdfRoutes');
const imageRoutes = require('./src/routes/imageRoutes');
const folderRoutes = require('./src/routes/folderRoutes');
const getClaims = require('./src/routes/claimRoutes');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
// Middleware to handle large file uploads
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// import routes
app.use('/pdf', pdfRoutes);
app.use('/image', imageRoutes);
app.use('/delete', folderRoutes);
app.use('/claim', getClaims)

app.listen(3002, () => {
    console.log(`Server is running on port 3002`);
});