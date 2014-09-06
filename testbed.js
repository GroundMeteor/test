var debug = false;

if (Meteor.isClient) {

  if (typeof window.location == 'undefined')
    throw new Error('Browser is not compatible with GroundTest - no "window.location"');


  // / == main test, /test/A == A
  var pathName = window.location && window.location.pathname;
  var clientName = pathName.substring(6);
  var isClient = /^\/test\//.test(pathName);
  var origin = window.location.origin;

  var testDb = new Meteor.Collection('_test_db', { connection: null });
  var testStatusDb = new Meteor.Collection('_test_status_db', { connection: null });

} else {

  var serverName = 'L';

}

var defaultServerName = 'L';

// Container for all the tests
var tests = [];

// Define the scope
GroundTest = {
  add: function(name, testFunction) {
    var index = tests.length;

    tests.push({ name: name, f: testFunction, steps: [], clients: {}, index: index });

    if (Meteor.isClient) {

      testStatusDb.insert({
        name: name,
        steps: 0,
        success: 0,
        failed: 0,
        done: false,
        index: index 
      });

    }
  }
};

var noop = function(f) {};

var eachTest = function(f) {
  if (typeof f !== 'function')
    throw new Error('eachTest requires Callback function');

  for (var t = 0; t < tests.length; t++) {
    // Callback
    f(tests[t], t);
  };  
};

// wait counter
var waiting = 0;

var resetClients = function() {
  eachTest(function(test, index) {
    // Iterate over children
    for (var i = 0; i < test.children.length; i++) {
      // XXX: remove event listeners...

      // Clean up dom
      document.body.removeChild(test.children[i]);

      // Clean up memory
      test.children[i] = null;
      delete test.children[i];
    }

    // Reset array
    test.children = [];
  });

  waiting = 0;
};

var runAsyncTask = function(test, step, callback) {
  var thisStep = tests[test].steps[step];

  var f = thisStep.f;
  var title = thisStep.title;

  try {    
    // Run the test function on the client
    f(function(txt) {

      var msg = {
        completed: true,
        error: !!txt,
        message: txt,
        test: test,
        step: step,
        server: serverName,
        client: clientName,
        title: title
      };

      // Call parent to report status about test run
      callback(null, msg);
    });

  } catch(err) {

    // On error send error
    var msg = {
      completed: true,
      error: true,
      message: err.message,
      stack: err.stack,
      test: test,
      step: step,
      server: serverName,
      client: clientName,
      title: title
    };        
    // Call parent to report status about test run
    callback(null, msg);
  }
};

var gotTestResult = function(data) {
  // Main communication
  debug && console.log('Main got', data);
  
  if (data.completed) {

    if (data.error) {
      testStatusDb.update({ index: data.test }, { $inc: { failed: 1 } });          
    } else {
      testStatusDb.update({ index: data.test }, { $inc: { success: 1 } });
    }

    testDb.insert(data);
    nextStep();
  }
};

if (Meteor.isClient) {

  window.addEventListener("message", function(event) {
    // Only this origin...
    if (event.origin !== origin)
      throw new Error('GroundTest requires same origin');

    // We always expect data object
    var data = event.data;

    // We dont care about empty data
    if (!data)
      return;

    debug && console.log('test', data.test, 'step', data.step);

    // event.data event.origin event.source
    if (isClient) {
      // Client communication
      debug && console.log('Client "' + clientName + '" got', data);
      if (data.run) {

        runAsyncTask(data.test, data.step, function(err, msg) {
          debug && console.log('Client post', msg);
          // Call parent to report status about test run
          parent.postMessage(JSON.stringify(msg), origin);
        });

      }

    } else {
      // Main communication
      debug && console.log('Main got from client', data);
      gotTestResult(JSON.parse(data));
    }
  }, false);
}

var currentTest = 0;
var currentStep = 0;

var nextStep = function() {

  Meteor.setTimeout(function() {

    // Get current test
    var test = tests[currentTest];

    if (currentStep < test.steps.length) {

      var thisStep = test.steps[currentStep];

      var target = thisStep.target;

      if (target.isClient) {

        var iframe = target.iframe.contentWindow;

        var msg = {
          run: true,
          step: currentStep,
          test: currentTest
        };


        debug && console.log('MESSAGE', msg, origin);

        iframe.postMessage(msg, origin);

      }

      if (target.isServer) {
        var test = currentTest;
        var step = currentStep;
        var title = thisStep.title;
        target.connection.call('runTest', test, step, function(error, data) {
          if (error) {
            data = {
              completed: true,
              error: true,
              message: error.message,
              stack: error.stack,
              test: test,
              step: step,
              server: target.name,
              title: title         
            };            
          }

          gotTestResult(data);
        });
      }

      currentStep++;

    } else {
      debug && console.log('Test ended');
      testStatusDb.update({ index: currentTest }, { $set: { done: true } });
      currentTest++;

      if (currentTest < tests.length) {
        startTest(currentTest);
      } else {

        debug && console.log('All tests ended');
      }
    }
    
  }, 0);

};


var startTest = function(index) {
  currentTest = index;
  currentStep = 0;

  // Helper
  var test = tests[currentTest];

  // Count the steps in the test...
  test.f.apply({
    Client: function(name) {
      // Make sure we track clients
      if (typeof test.clients[name] === 'undefined') {
        // XXX: create connection + iframe etc.
        var iframe = document.createElement("IFRAME");

        // Inc waiting counter
        waiting++;

        // Hide iframe
        iframe.style.display = 'none';

        // Add to dom
        document.body.appendChild(iframe);

        // Create the client container
        var client = {
          isClient: true,
          name: name,
          iframe: iframe,
          loaded: false,
        };

        iframe.addEventListener('load', function() {
          client.loaded = true;
          debug && console.log('Client', name, 'loaded');

          // Wait a bit
          Meteor.setTimeout(function() {
            // Dec waiting
            waiting--;

            // If done waiting for clients we start stepper
            if (!waiting) nextStep();
          }, 500);
        });

        iframe.src = 'test/' + name;
        debug && console.log('Added test/'+name);

        test.clients[name] = client;
      }

      var target = test.clients[name];

      // Return the step register function
      return function(title, stepFunction) {
        // Store step
        test.steps.push({ title: title, target: target });
        if (Meteor.isClient)
          testStatusDb.update({ index: test.index }, { $inc: { steps: 1 } });
      };
    },
    Server: function(name, connection) {
      // Pretty name...
      name = name || defaultServerName;

      if (typeof test.clients[name]) {
        var server = {
          isServer:true,
          name: name,
          connection: connection || Meteor.connection,
          loaded: true,
        };

        debug && console.log('Added test', name);
        test.clients[name] = server;
      }

      var server = test.clients[name];

      return function(title, stepFunction) {
        test.steps.push({ title: title, target: server });
        if (Meteor.isClient)
          testStatusDb.update({ index: test.index }, { $inc: { steps: 1 } });
      };
    }
  });

  // Ok we are back and should be all set to start the test...
};

var clientTestApp = function(currentName) {
  debug && console.log('Client test app "' + currentName + '"');

  eachTest(function(test, index) {
    test.f.apply({
      Client: function(name) {
        return function(title, stepFunction) {
          if (name == currentName) {
            // Ok this step should run on this client
            test.steps.push({ title: title, f: stepFunction });
          } else {
            // Noop, another client is going for this...
            test.steps.push({ title: title, f: noop });
          }
        };
      },
      Server: function(name) {
        return function(title, stepFunction) {        
          // Noop, server is going for this...
          test.steps.push({ title: title, f: noop });
        }
      }
    });
  });

};

var serverTestApp = function(currentName) {
  // Make sure we have a pretty name
  currentName = currentName || defaultServerName;

  debug && console.log('Server test app "' + currentName + '"');

  eachTest(function(test, index) {
    test.f.apply({
      Client: function(name) {
        return function(title, stepFunction) {        
          // Noop, clients is going for this...
          test.steps.push({ title: title, f: noop });        
        };
      },
      Server: function(name) {
        // Pretty name
        name = name || defaultServerName;

        return function(title, stepFunction) {
          if (name == currentName) {
            // Ok this step should run on this server
            test.steps.push({ title: title, f: stepFunction });
          } else {
            // Noop, another server is going for this...
            test.steps.push({ title: title, f: noop });
          }
        };
      }
    });
  });

};

Meteor.startup(function() {
  if (Meteor.isClient) {
    if (typeof document.body == 'undefined') throw new Error('I need somebody');

    if (isClient) {
      clientTestApp(clientName);
    } else {
      startTest(0);
    }
  }

  if (Meteor.isServer) {
    serverTestApp();
  }

});

if (Meteor.isClient) {

  Template.listResults.clientName = function(t, c) {
    return tests[t].clients[c].name;
  };

  Template.listResults.testName = function(n) {
    return tests[n].name;
  };

  Template.listResults.items = function() {
    return testDb.find({ test: this.index });
  };

  Template.test_results.tests = function() {
    return testStatusDb.find();
  };


}


if (Meteor.isServer) {

  var runSyncTask = Meteor._wrapAsync(runAsyncTask);

  Meteor.methods({
    'runTest': function(test, step) {

      debug && console.log('Run test', test, step);
      return runSyncTask(test, step);
    }
  });
}