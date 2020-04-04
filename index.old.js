const aws = require('aws-sdk');
const Busboy = require('busboy');
const stream = require('stream');

const uploadStream = ({ Bucket, Key }) => {
  const s3 = new aws.S3();
  const pass = new stream.PassThrough();
  return {
    writeStream: pass,
    promise: s3.upload({ Bucket, Key, Body: pass }).promise(),
  };
}

exports.handler = async (event) => {
    return new Promise((resolve, reject) => {

        let response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: ''
        };

        const done = (err, res) => {
            if (!err){
                response.body = res;
                resolve(response);
            } else {
                response.body = err.message;
                response.statusCode = 400;
                reject(response);
            }
        }

        const s3 = new aws.S3({apiVersion: '2006-03-01'});

        const bucketName = "gp-sharing-bucket";

        switch (event.httpMethod) {
            case 'POST':
                let buff = Buffer.from(event.body, 'base64');
                let formData = buff.toString('ascii');

                const contentType = event.headers['Content-Type'] || event.headers['content-type'];

                const busboy = new Busboy({ headers: { 'content-type': contentType }});
                let fileData = '';
                let folder = '';
                busboy.on('field', (fieldName, val) => {
                    console.log('Field [%s]: value: %j', fieldName, val)
                    if (fieldName === 'folder'){
                        folder = val;
                    }
                }).on('file', function (fieldname, fileStream, filename, encoding, mimetype) {
                    console.log('File [%s]: filename=%j; encoding=%j; mimetype=%j', fieldname, filename, encoding, mimetype);
                    if (folder !== ''){
                        const fullFileName = folder + '/' + filename;
                        const { writeStream, promise } = uploadStream({Bucket: 'gp-sharing-bucket', Key: fullFileName});
                        fileStream.pipe(writeStream);
                        promise.then(data => {
                            console.log('Finished');
                            done(null, data);
                        }).catch(err => {
                            console.log('Error', err);
                            done(err);
                        });
                    } else {
                        console.log('No folder selected');
                        done('No folder selected');
                    }
                }).on('finish', () => {
                    console.log('Done parsing form!');
                }).on('error', err => {
                    console.log('failed', err);
                });
                busboy.end(formData);
                break;
            default:
                done(new Error(`Unsupported method "${event.httpMethod}"`));
        }
    });
}
