const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('신호개방_CrossRoadInfoService.pdf');

pdf.PDFParse(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(function(error){
    console.error(error);
});
