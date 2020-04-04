const aws = require('aws-sdk');

const docClient = new aws.DynamoDB.DocumentClient();

const loginHashCheck = loginHash => {
    const params = {
        TableName: "gps",
        ProjectionExpression: "email, hashExpires",
        FilterExpression: "#hs = :inputHashString",
        ExpressionAttributeNames: {
            "#hs": "hashString",
        },
        ExpressionAttributeValues: {
             ":inputHashString": loginHash
        }
    };

    console.log(`Hash sent ${loginHash}`);

    return new Promise((resolve, reject) => {
        docClient.scan(params, async (err, res) => {
            if (!err){
                const item = res.Items[0];
                resolve(item);
            } else {
                reject(err);
            }
        });
    });
};

exports.handler = async (event) => {
    return new Promise(async (resolve, reject) => {

        let response = {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': "*",
                'Content-type' : 'application/json'
            },
            body: ''
        };

        const done = (err, url) => {
            if (!err){
                response.body = JSON.stringify({ "url": url });
                resolve(response);
            } else {
                response.body = err.message;
                response.statusCode = 400;
                reject(response);
            }
        }

        const s3 = new aws.S3({apiVersion: '2006-03-01', signatureVersion: 'v4', region: 'eu-west-2'});

        const bucketName = "gp-sharing-bucket";

        switch (event.httpMethod) {
            case 'GET':
                const documentToUpload = event.queryStringParameters.document;
                const mimeType = event.queryStringParameters.mimeType;

                const credentialError = (err) => {
                    response.body = err;
                    response.statusCode = 401;
                    reject(response);
                }

                const loginHash = event.queryStringParameters.hash;
                if (loginHash){
                    const userItem = await loginHashCheck(loginHash);
                    if (!userItem){
                        credentialError('No credentials found for: ' + loginHash);
                    } else {
                        console.log(`${userItem.email} is uploading document: ${documentToUpload}`);
                    }
                } else {
                    // credentialError('No login hash found');
                }

                console.log('Document to upload', documentToUpload);
                let params = {
                  Bucket: bucketName,
                  Key: documentToUpload,
                  Expires: 10
                };

                if (mimeType){
                    params.ContentType = mimeType;
                }
                console.log(params);

                const url = s3.getSignedUrl('putObject', params);

                done(null, url);
                break;
            case 'POST':
                const onlineResource = JSON.parse(event.body);
                if (onlineResource.url && onlineResource.title) {
                    const lastUpdated = new Date().getTime();
                    const params = {
                        TableName: 'gisp-online-resources',
                        Item:{
                            "url": onlineResource.url,
                            "title": onlineResource.title,
                            "lastUpdated": lastUpdated
                        }
                    };

                    const docClient = new aws.DynamoDB.DocumentClient();

                    console.log(params);
                    console.log("Creating new item...");
                    docClient.put(params, (err, data) => {
                        if (err) {
                            console.log("ERR: ", err);
                            done({message: "Unable to create item. Error JSON: " + JSON.stringify(err, null, 2) + " DATA: " + JSON.stringify(data, null, 2)});
                        } else {
                            console.log("PutItem succeeded:", JSON.stringify(data, null, 2));
                            done(null, data);
                        }
                    });
                } else {
                    done({message: 'URL or title not set' });
                }
                break;
            case 'OPTIONS':
                done(null, '');
                break;
            default:
                done(new Error(`Unsupported method "${event.httpMethod}"`));
        }
    });
}
