const ExifReader = require("exifreader");
const axios = require("axios");
const { formatDate, isValidClaimDate } = require("../util/helper");

const extractExifData = (buffer, claimDate) => {
  const tags = ExifReader.load(buffer);
  const dateTimeExif = tags["DateTime"]?.description;
  const formattedDate = dateTimeExif ? formatDate(dateTimeExif.split(" ")[0]) : "Date not found";

  const validationMessage = isValidClaimDate(
    new Date(formattedDate),
    new Date(claimDate)
  )
    ? "Valid Evidence"
    : "Please upload images that are taken recently";

  return { formattedDate, validationMessage };
};

const analyzeImageContent = async (imageBuffer, itemCovered) => {
    try {
      const mimeType = "image/jpeg";
  
      const data = JSON.stringify({
        contents: {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: imageBuffer.toString("base64"),
              },
            },
            {
              text: `Analyze the image and tell me what object it contains. I will also give you an object name to check for a match. Please provide the output in the JSON format for easy accessing and slicing:
                      "ObjectName": "Expected object name",
                      "AnalyzedImageDescription": "A brief description of what the image contains",
                      "MatchingPercentage": "Matching percentage as a number without the % symbol"
                  The object name to check is ${itemCovered}.`,
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
  
      const response = await axios.request(config);
      console.log("API Response:", response.data);
  
      let rawContent = response?.data?.message?.content;
  
      // Improved cleaning steps
      rawContent = rawContent
        .replace(/``` (json)?/g, "") // Remove markdown JSON formatting if present
        .replace(/\\n/g, "") // Remove escaped newlines
        .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
        .trim(); // Trim leading and trailing whitespace
  
      // Check if the content is valid JSON
      if (!rawContent.startsWith("{") || !rawContent.endsWith("}")) {
        throw new Error("The API response is not valid JSON.");
      }
  
      const parsedJson = JSON.parse(rawContent);
      console.log("Parsed JSON Content:", parsedJson);
      const matchPercent = parsedJson['MatchingPercentage'];
  
      const matchingPercentage = parseInt(matchPercent, 10);
  
      let claimStatus;
      if (isNaN(matchingPercentage) || matchingPercentage < 80) {
        claimStatus = {
          status: "Rejected",
          reason: "The matching percentage is below the acceptable threshold.",
        };
      } else {
        claimStatus = {
          status: "Authorized",
        };
      }
  
      return {
        "Damaged Component": parsedJson["ObjectName"],
        "Evidence Content": parsedJson["AnalyzedImageDescription"],
        "Matching percentage": matchingPercentage,
        "Evidence Relevance": matchingPercentage > 80 ? "Relevant" : "Irrelevant",
        "Claim Status": claimStatus,
      };
    } catch (error) {
      console.error("Error analyzing image content:", error.message);
      throw error;
    }
};  

module.exports = { analyzeImageContent, extractExifData };
