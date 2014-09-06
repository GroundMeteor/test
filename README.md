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
if (Meteor.isServer) {
  db = new Meteor.Collection('test');
}

if (Meteor.isClient) {
  localStorage.clear();
}

GroundTest.add('Inserts', function() {

  // Insert iframe 
  var clientA = new this.Client('A');
  var clientB = new this.Client('B');

  // Use this server
  var server = new this.Server();

  // Step 0
  server('Server removes all data in test collection', function(complete) {
    // Empty test db
    db.remove();

    complete(); 
  });

  // Step 1
  clientA('Rig GroundDB Empty and inserts doc', function(complete) {
    db = new GroundDB('test');

    db.find({}).forEach(function(doc) {
      db.remove({ _id: doc._id });
    });

    db.insert({ foo: 'bar' }, function(err) {
      complete();
    });
  });

  // step 2
  clientB('Rig GroundDB, findOne doc then disconnect', function(complete) {
    db = new GroundDB('test');

    var item = db.findOne({});

    Meteor.disconnect();

    if (!item || item.foo !== 'bar')
      complete('Could not find item with foo==bar')
    else
      complete();

  });

  // Step 3
  clientA('findOne doc, update this and wait a sec', function(complete) {

    var item = db.findOne({});

    db.update({ _id: item._id }, { foo: 'foo' }, function(err) {
      Meteor.setTimeout(function() {
        complete();
      }, 1000);
    });

  });


  // step 4
  clientB('check offline, then check if tab sync works', function(complete) {
    var connection = Meteor.connection.status();

    if (connection.status == 'connected') {
      complete('Should not be connected...');
      return;
    }

    var item = db.findOne({});

    if (!item || item.foo !== 'foo')
      complete('Could not find item with foo==foo tabs did not sync?')
    else
      complete();

  });

});
```