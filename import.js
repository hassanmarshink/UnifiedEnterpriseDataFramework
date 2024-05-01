const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');

const metadataUrl = 'https://apisalesdemo8.successfactors.com/odata/v2/$metadata';
const metadataPath = './metadata.xml';

axios.get(metadataUrl, {
  auth: {
    username: 'sfadmin@SFPART069673',
    password: 'Part@dc70'
  }
})
.then(response => {
  fs.writeFileSync(metadataPath, response.data);
  exec(`cds import ${metadataPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error importing metadata: ${error}`);
    } else {
      console.log('Metadata imported successfully');
    }
  });
})
.catch(error => {
  console.error(`Error downloading metadata: ${error}`);
});