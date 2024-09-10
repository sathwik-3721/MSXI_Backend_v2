    const { extractText, analyzeText } = require("../services/pdfService");

    let itemCovered = null;
    let claimDate = null;

    const extractPdf = async (req, res) => {
    try {
        if (!req.file) {
        return res.status(200).send("No file uploaded.");
        }

        const data = await extractText(req.file.buffer);

        const claimInfo = await analyzeText(data);
        console.log("Claim Info:", claimInfo);

        itemCovered = claimInfo["Items Covered"];
        claimDate = claimInfo["Claim Date"];

        return res.json({ claimInfo });
    } catch (error) {
        console.error("Error processing PDF request:", error.message);
        res.status(500).send("Error processing PDF.");
    }
    };

    const getClaimDetails = () => ({ itemCovered, claimDate });

    module.exports = {
    extractPdf,
    getClaimDetails
    };
