ground:test
===========

Basic syncronious test tool built for ground db.

What: It allows you to run tests in multiple clients and on the server.

## How to install
```bash
$ meteor add ground:test
```

## How this works
You create a qa meteor app, add ground:test and start writing your tests in the common server/client space - the test tool will make sure tests run in the correct environment.

Create a file "test1.js":
```js
GroundTest.add('Test common online insert/update/remove', function() {

  var clientA = new this.Client('A');

  var clientB = new this.Client('B');

  var server = new this.Server();

  // Step 0
  server('Clean db', function(complete) {
    db.remove({});
    complete();
  });

  // Step 1
  clientA('Create document on the client', function(complete) {
    db = new GroundDB('test');

    db.insert({ test: 2, foo: 'test_new_document', bar: 'online' }, function(err, id) {
      if (err) {
        complete(err.message);
      } else {
        complete();
      }
    });
  });

  // Step 2
  server('Verify created document', function(complete) {
    var doc = db.findOne({ test: 2 });

    if (doc) {
      
      if (doc.foo == 'test_new_document' && doc.bar == 'online') {
        complete();
      } else {
        complete('Document is found but contains invalid data');
      }

    } else {
      complete('Could not find any documents matching');
    }
  });

  // Step 3
  clientB('Verify created document', function(complete) {
    db = new GroundDB('test');

    var doc = db.findOne({ test: 2 });

    if (doc) {
      
      if (doc.foo == 'test_new_document' && doc.bar == 'online') {
        complete();
      } else {
        complete('Document is found but contains invalid data');
      }

    } else {
      complete('Could not find any documents matching');
    }
  });


  // Step 4
  clientA('Update document on the client', function(complete) {
    var doc = db.findOne({ test: 2 });

    db.update({ _id: doc._id }, { $set: { foo: 'test_update_document' } }, function(err) {
      if (err) {
        complete(err.message);
      } else {
        complete();
      }
    });
  });

  // Step 5
  server('Verify updated document', function(complete) {
    var doc = db.findOne({ test: 2 });

    if (doc) {
      
      if (doc.foo == 'test_update_document' && doc.bar == 'online') {
        complete();
      } else {
        complete('Document is found but contains invalid data');
      }

    } else {
      complete('Could not find any documents matching');
    }
  });

  // Step 6
  clientB('Verify updated document', function(complete) {
    var doc = db.findOne({ test: 2 });

    if (doc) {
      
      if (doc.foo == 'test_update_document' && doc.bar == 'online') {
        complete();
      } else {
        complete('Document is found but contains invalid data');
      }

    } else {
      complete('Could not find any documents matching');
    }
  });


  // Step 6
  clientA('Remove document on the client', function(complete) {
    var doc = db.findOne({ test: 2 });

    db.remove({ _id: doc._id }, function(err) {
      if (err) {
        complete(err.message);
      } else {
        complete();
      }      
    });
  });

  // Step 7
  server('Verify removed document', function(complete) {
    var doc = db.findOne({ test: 2 });

    if (doc) {
      complete('Document not removed');
    } else {
      complete();
    }
  });

  // Step 8
  clientB('Verify removed document', function(complete) {
    var doc = db.findOne({ test: 2 });

    if (doc) {
      complete('Document not removed');
    } else {
      complete();
    }
  });

});
```