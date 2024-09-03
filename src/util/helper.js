exports.formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split(":");
    const date = new Date(`${year}-${month}-${day}`);
    const options = { year: "numeric", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };
  
exports.isValidClaimDate = (metaDataDate, claimDate) => {
    const thirtyDaysBefore = new Date(claimDate);
    thirtyDaysBefore.setDate(claimDate.getDate() - 30);
    return metaDataDate >= thirtyDaysBefore && metaDataDate <= claimDate;
};
  