const ExifReader = require("exifreader");
const axios = require("axios");
const { formatDate, isValidClaimDate } = require("../util/helper");
const { getPDFDescription, getImageDescriptions } = require('../util/dbQueries'); // Adjust path as needed


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
                              "AnalyzedImageDescription": "A brief description of what the image contains. Like what objects are there in the image given to you irrespective to itemcovered",
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

        // Attempt to parse the cleaned content
        let parsedJson;
        try {
            parsedJson = JSON.parse(rawContent);
            console.log("Parsed JSON Content:", parsedJson);
        } catch (error) {
            throw new Error("The API response is not valid JSON.");
        }

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
            "Evidence Content": parsedJson["AnalyzedImageDescription"] || parsedJson["AnalyzedImage Description"] || parsedJson[" AnalyzedImageDescription"],
            "Matching percentage": matchingPercentage,
            "Evidence Relevance": matchingPercentage > 80 ? "Relevant" : "Irrelevant",
            "Claim Status": claimStatus,
        };
    } catch (error) {
        console.error("Error analyzing image content:", error.message);
        throw error;
    }
};
  
const aiSuggestion = async (claimID) => {
    try {
        // Get PDF description
        const pdfDescResult = await getPDFDescription(claimID);
        const pdfDescription = pdfDescResult ? pdfDescResult.pdf_description : "No PDF description available";

        // Get image descriptions
        const imageDescriptions = await getImageDescriptions(claimID);
        console.log("imagedescriptions", imageDescriptions);

        // Prepare data for `miraAI` API
        const data = JSON.stringify({
            contents: {
                role: "user",
                parts: [
                    {
                        text: `You are an expert in analyzing the given PDF description and image descriptions.
                               Your task is to analyze the given PDF description and image descriptions and provide a result in the format below.
                               AI Suggestion: Accept, Reject, or Pending (if further evidence is needed)
                               PDF Description is: ${pdfDescription}
                               Image Descriptions: ${imageDescriptions}`
                    }
                ]
            }
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

        // Send request to `miraAI` API
        const response = await axios.request(config);

        // Process the API response
        const aiSuggestionResult = response.data;
        const suggestion = aiSuggestionResult.suggestion; // Adjust based on actual response structure

        // Return AI suggestion result
        return {
            claimID: claimID,
            aiSuggestion: suggestion
        };

    } catch (error) {
        console.error("Error in aiSuggestion:", error.message);
        throw new Error("Error processing AI suggestion.");
    }
};

module.exports = { analyzeImageContent, extractExifData, aiSuggestion };
