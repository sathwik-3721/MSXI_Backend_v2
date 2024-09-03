const { PDFExtract } = require("pdf.js-extract");
const axios = require('axios');
const pdfExtract = new PDFExtract();

// function to extract the pdf contents
const extractText = (buffer) => {
    return new Promise((resolve, reject) => {
        pdfExtract.extractBuffer(buffer, {}, (err, data) => {
            if (err) reject (err);
            else resolve(data);
        });
    });
};

// function to analyze the text
const analyzeText = async(fileContent) => {
    console.log("File Content (Buffer):", fileContent);
  
    let fileText;
  
    // Convert buffer to string if necessary
    if (Buffer.isBuffer(fileContent)) {
      fileText = fileContent.toString("utf-8");
      console.log("buff");
    } else if (typeof fileContent === "object") {
      // Convert object to JSON string if it's an object
      fileText = JSON.stringify(fileContent);
      console.log("obj");
    } else {
      // Assume it's already a string
      fileText = fileContent;
      console.log("str");
    }
  
    const claimantPrompt = `Analyze the following text and extract the following information in JSON format:
          - Name: The full name of the customer
          - Vehicle Info: Details about the vehicle involved
          - Claim Status: The current status of the claim, which should be one of "Approved", "Rejected", or "Pending"
          - Claim Date: The date the claim was received
          - Reason: If the claim is rejected, provide the reason; if approved, provide the reason for approval
          - Items Covered: The item covered in the claim (Component)
  
          Here's the text to analyze:
          ${fileText}`;
  
    const dealerPrompt = `Analyze the following text and extract the following information in JSON format:
          - Name: The full name of the dealer
          - Location: The address of the dealership
          - Claim Status: The current status of the claim, which should be one of "Approved", "Rejected", or "Pending"
          - Claim Date: The date the claim was received
          - Reason: If the claim is rejected, provide the reason; if approved, provide the reason for approval
          - Items Covered: The item covered in the claim (Component)
  
          Here's the text to analyze:
          ${fileText}`;
  
    const serviceCenterPrompt = `Analyze the following text and extract the following information in JSON format:
          - Name: The name of the service center
          - Location: The location of the service center
          - Claim Status: The current status of the claim, which should be one of "Approved", "Rejected", or "Pending"
          - Claim Date: The date the claim was received
          - Reason: If the claim is rejected, provide the reason; if approved, provide the reason for approval
          - Items Covered: The item covered in the claim (Component)
  
          Here's the text to analyze:
          ${fileText}`;
  
    async function analyzeWithPrompt(prompt) {
      try {
        const data = JSON.stringify({
          contents: {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        });
  
        const config = {
          method: "post",
          maxBodyLength: Infinity,
          url: process.env.MIRA_AI_URL,
          headers: {
            model: process.env.MIRA_AI_MODEL,
            "access-key": process.env.MIRA_AI_ACCESS_KEY,
            "Content-Type": "application/json",
          },
          data: data,
        };
  
        const result = await axios.request(config);
  
        const responseContent = result.data.message.content;
        console.log("Raw Response Content:", responseContent);
  
        let cleanedText = responseContent
          .replace(/^``` json\n/, "")
          .replace(/\n```$/, "");
  
        console.log("Cleaned Response Text Before Parsing:", cleanedText);
  
        try {
          return JSON.parse(cleanedText);
        } catch (jsonError) {
          console.error("JSON Parsing Error:", jsonError.message);
          console.log("Attempting to further clean the text...");
  
          cleanedText = cleanedText.replace(/`/g, "").trim();
          console.log("Further Cleaned Text:", cleanedText);
  
          return JSON.parse(cleanedText);
        }
      } catch (error) {
        console.error("Error analyzing text:", error.message);
        return null;
      }
    }
  
    if (fileText.includes("Claimant Information:")) {
      return analyzeWithPrompt(claimantPrompt);
    } else if (fileText.includes("Dealer Information:")) {
      return analyzeWithPrompt(dealerPrompt);
    } else if (fileText.includes("Service Center Information:")) {
      return analyzeWithPrompt(serviceCenterPrompt);
    } else {
      console.error("Unknown information type.");
      return null;
    }
}; 

module.exports = { extractText, analyzeText }