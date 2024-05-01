const cds       = require("@sap/cds");
const fs        = require("fs");
const {Client}  = require("pg");
const axios     = require("axios");
const {exec}    = require("child_process");
require('dotenv').config();

const metadataPath         = "srv/external/metadata.xml";
const allEntitiesDataFile  = './allEntitiesData.json';
const dataMigrationService = "srv/data-migration.cds"; // path to data migration service
const csnPath              = "srv/external/metadata.csn"; // Path to the CSN file
const cdsPath              = "db/output.cds"; // Path to the output CDS file
const sqlPath              = "db/output.sql"; // Path to the output SQL file
const metadataUrl          = process.env.METADATA_URL;

const client = new Client({
    user:       process.env.POSTGRES_USER,
    password:   process.env.POSTGRES_PASSWORD,
    host:       process.env.POSTGRES_HOST,
    port:       process.env.POSTGRES_PORT,
    database:   process.env.POSTGRES_DATABASE
});

client.connect().then(() => {
    console.log("Database connection established");
}).catch((error) => {
    console.log("Database connection error", error);
});

axios
    .get(metadataUrl, {
        auth: {
            username: 'sfadmin@SFPART069673',
            password: 'Part@dc70'
        },
    })
    .then((response) => {
        fs.writeFileSync(metadataPath, response.data);
        exec(`cds import ${metadataPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error importing metadata: ${error}`);
            } else {
                console.log("Metadata imported successfully");
                // Load the CSN from a file
                const csn = JSON.parse(fs.readFileSync(csnPath, "utf8"));
                // Array to store entity names
                const entityArray = [];

                for (const [key, value] of Object.entries(csn.definitions)) {
                    meta = key.replaceAll('metadata.', '');
                    if (value.kind == 'entity') {
                        entityArray.push(meta);
                    }
                }
                console.log("Total number of entities:", entityArray.length);

                const allEntitiesData = {};
                getEntityData(0);

                function getEntityData(index) {
                    if (index < entityArray.length) {
                        const entity = entityArray[index];
                        const endpointUrl = `https://apisalesdemo8.successfactors.com/odata/v2/User?$skip=2&$top=2`;
                        axios.get(endpointUrl, {
                                auth: {
                                    username: 'sfadmin@SFPART069673',
                                    password: 'Part@dc70'
                                }
                            }).then(response => {
                                let data = response.data;
                                //allEntitiesData[entity] = data;
                                //console.log(`Data for entity ${entity} stored.`);
                                for (const [key, value] of Object.entries(data.d.results[0])) {
                                   // console.log(`${key} : ${value}`);
                                   let userData = value;
                                   if(key === '__metadata')
                                   {
                                       continue;
                                   }
                                   console.log(userData);

                                //userData.forEach(user => {
                                //     const query = {
                                //         text: 'INSERT INTO users() VALUES ()',
                                //         value : [user.userId, user.state, user.email]
                                //     };

                                //     client.query(query, (err, res) => {
                                //         if (err) {
                                //             console.error('Error inserting user data:', err);
                                //         } else {
                                //             console.log('User data inserted successfully:', user.UserID);
                                //         }
                                //     });
                                // });
                                }
                                //getEntityData(index + 1);
                            })
                            .catch(error => {
                                console.error(`Error fetching data for entity ${entity}:`);
                                getEntityData(index + 1);
                            });
                    } else {
                        fs.writeFileSync(allEntitiesDataFile, JSON.stringify(allEntitiesData));
                        console.log(`All entities data stored in ${allEntitiesDataFile}`);
                    }
                }

                // function insertUserData() {
                //     // Retrieve user data from the stored entities data
                //     // const userData = Object.values(data.d.results[0])
                //     // console.log(userData);

                //     // Insert the retrieved user data into PostgreSQL
                //     // userData.forEach(user => {
                //     //     const query = {
                //     //         text: 'INSERT INTO users() VALUES ()',
                //     //         value : [user.userId, user.state, user.email]
                //     //     };

                //     //     client.query(query, (err, res) => {
                //     //         if (err) {
                //     //             console.error('Error inserting user data:', err);
                //     //         } else {
                //     //             console.log('User data inserted successfully:', user.UserID);
                //     //         }
                //     //     });
                //     // });
                // }

                // Create a new Service entity (catalog-service.cds) file 
                let catalogServiceContent = `
                    using {db.sql as db} from '../db/output';
                    
                    Service DataMigration {`;

                entityArray.forEach(entity => {
                    catalogServiceContent += `
                        entity ${entity} as projection on db.${entity};`;
                });

                catalogServiceContent += `
                    }
                `;

                const catalogServiceFilePath = `${dataMigrationService}`;
                fs.writeFileSync(catalogServiceFilePath, catalogServiceContent);

                // Create a new CSN object that only includes the specified entities
                const newCsn = {
                    definitions: {}
                };
                for (const entity of entityArray) {
                    const trimmedEntity = entity.trim().replace(/'/g, ''); // remove single quotes
                    if (csn.definitions[`metadata.${trimmedEntity}`]) {
                        newCsn.definitions[trimmedEntity] = csn.definitions[`metadata.${trimmedEntity}`];
                        // Set @cds.persistence.skip to false
                        newCsn.definitions[trimmedEntity]['@cds.persistence.skip'] = false;
                    }
                }

                // Convert the new CSN to CDS
                const cdsString = cds.compile.to.cdl(newCsn);
                // Write the CDS string to a file
                fs.writeFileSync(cdsPath, cdsString);
                console.log("CSN converted to CDS successfully");
            }
        });
    })
    .catch((error) => {
        console.error(`Error downloading metadata: ${error}`);
    });