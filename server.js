const http = require('http');
const url = require('url');
const fs = require('fs');
const formidable = require('formidable');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectID = require('mongodb').ObjectID;
const mongourl = '';
const dbName = 'test';

const server = http.createServer((req, res) => {
  let timestamp = new Date().toISOString();
  console.log(`Incoming request ${req.method}, ${req.url} received at ${timestamp}`);

  let parsedURL = url.parse(req.url,true); // true to get query as object
  
  if (parsedURL.pathname == '/fileupload' && 
      req.method.toLowerCase() == "post") {
    // parse a file upload
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
      // console.log(JSON.stringify(files));
      if (files.filetoupload.size == 0) {
        res.writeHead(500,{"Content-Type":"text/plain"});
        res.end("No file uploaded!");  
      }
      const filename = files.filetoupload.path;
      let title = "untitled";
      //
      let description = "n/a"
      //
      let mimetype = "images/jpeg";
      if (fields.title && fields.title.length > 0) {
        title = fields.title;
      }
      //
      if (fields.description && fields.description.length > 1) {
        description = fields.description;
      }
      //
      if (files.filetoupload.type) {
        mimetype = files.filetoupload.type;
      }
      fs.readFile(files.filetoupload.path, (err,data) => {
        let client = new MongoClient(mongourl);
        client.connect((err) => {
          try {
              assert.equal(err,null);
            } catch (err) {
              res.writeHead(500,{"Content-Type":"text/plain"});
              res.end("MongoClient connect() failed!");
              return(-1);
          }
          const db = client.db(dbName);
          let new_r = {};
          new_r['title'] = title;
          //
          new_r['description'] = description;
          //
          new_r['mimetype'] = mimetype;
          new_r['image'] = new Buffer.from(data).toString('base64');
          insertPhoto(db,new_r,(result) => {
            client.close();
            res.writeHead(200, {"Content-Type": "text/html"});
            res.write('<html><body>Photo was inserted into MongoDB!<br>');
            res.end('<a href="/photos">Back</a></body></html>')
          })
        });
      })
    });
  } else if (parsedURL.pathname == '/photos') {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
      try {
          assert.equal(err,null);
        } catch (err) {
          res.writeHead(500,{"Content-Type":"text/plain"});
          res.end("MongoClient connect() failed!");
          return(-1);
      }      
      console.log('Connected to MongoDB');
      const db = client.db(dbName);
      findPhoto(db,{},(photos) => {
        client.close();
        console.log('Disconnected MongoDB');
        res.writeHead(200, {"Content-Type": "text/html"});			
        res.write('<html><head><title>Photos</title></head>');
        res.write('<body><H1>Photos</H1>');
        res.write('<H2>Showing '+photos.length+' document(s)</H2>');
        res.write('<ol>');
        for (i in photos) {
          res.write('<li><a href=/display?_id='+
          photos[i]._id+'>'+photos[i].title+'</a></li>');
        }
        res.write('</ol>');
        res.end('</body></html>');
      })
    });
  } else if (parsedURL.pathname == '/display') {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
      try {
        assert.equal(err,null);
      } catch (err) {
        res.writeHead(500,{"Content-Type":"text/plain"});
        res.end("MongoClient connect() failed!");
        return(-1);
      }
      console.log('Connected to MongoDB');
      const db = client.db(dbName);
      let criteria = {};
      criteria['_id'] = ObjectID(parsedURL.query._id);
      findPhoto(db,criteria,(photo) => {
        client.close();
        console.log('Disconnected MongoDB');
        console.log('Photo returned = ' + photo.length);
        /*
        let image = new Buffer.from(photo[0].image,'base64');       
        let contentType = {};
        contentType['Content-Type'] = photo[0].mimetype;
        console.log(contentType['Content-Type']);
        if (contentType['Content-Type'] == "image/jpeg") {
          console.log('Preparing to send ' + JSON.stringify(contentType));
          res.writeHead(200, contentType);
          res.end(image);
        } else {
          res.writeHead(500,{"Content-Type":"text/plain"});
          res.end("Not JPEG format!!!");  
        }
        */
        res.writeHead(200, 'text/html');
        res.write('<html><head><style>img{max-width:100%;height:auto;max-height:100%;}</style></head><body>');
        if (photo[0].title) {
          res.write(`<html><body><center><h1>${photo[0].title}</h1></center>`);
        }
        if (photo[0].description) {
          res.write(`<html><body><center><h2>${photo[0].description}</h2></center>`);
        }
        res.write(`<center><img src="data:${photo[0].mimetype};base64, ${photo[0].image}"></center>`);
        //res.write('<img src="data:image/gif;base64,R0lGODlhEAAOALMAAOazToeHh0tLS/7LZv/0jvb29t/f3//Ub//ge8WSLf/rhf/3kdbW1mxsbP//mf///yH5BAAAAAAALAAAAAAQAA4AAARe8L1Ekyky67QZ1hLnjM5UUde0ECwLJoExKcppV0aCcGCmTIHEIUEqjgaORCMxIC6e0CcguWw6aFjsVMkkIr7g77ZKPJjPZqIyd7sJAgVGoEGv2xsBxqNgYPj/gAwXEQA7">');
        res.end('</body></html>');
      });
    });
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<form action="fileupload" method="post" enctype="multipart/form-data">');
    res.write('Title: <input type="text" name="title"><br>');
    //
    res.write('Description: <input type="text" name="description"><br>');
    //
    res.write('<input type="file" name="filetoupload"><br>');
    res.write('<input type="submit">');
    res.write('</form>');
    res.end();
  }
});

const insertPhoto = (db,r,callback) => {
  db.collection('photo').insertOne(r,(err,result) => {
    assert.equal(err,null);
    console.log("insert was successful!");
    console.log(JSON.stringify(result));
    callback(result);
  });
}

const findPhoto = (db,criteria,callback) => {
  const cursor = db.collection("photo").find(criteria);
  let photos = [];
  cursor.forEach((doc) => {
    photos.push(doc);
  }, (err) => {
    // done or error
    assert.equal(err,null);
    callback(photos);
  })
}

server.listen(process.env.PORT || 8099);
