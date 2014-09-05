if (Meteor.isClient) {

  if (typeof window.location == 'undefined')
    throw new Error('Browser is not compatible with tabTest - no "window.location"');


  // / == main test, /test/A == A
  var pathName = window.location && window.location.pathname;
  var clientName = pathName.substring(6);
  var isClient = /^\/test\//.test(pathName);
  var origin = window.location.origin;

  var testDb = new Meteor.Collection('_test_db', { connection: null });

} else {

  var serverName = 'local';

}

var defaultServerName = 'local';

// Container for all the tests
var tests = [];

// Define the scope
tabTest = {
  add: function(name, testFunction) {
    tests.push({ name: name, f: testFunction, steps: [], clients: {} });
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

if (Meteor.isClient) {

  window.addEventListener("message", function(event) {
    // Only this origin...
    if (event.origin !== origin)
      throw new Error('tabTest requires same origin');

    // We dont care about empty data
    if (!event.data)
      return;

    // We always expect json data
    var data = JSON.parse(event.data);

    // event.data event.origin event.source
    if (isClient) {
      // Client communication
      console.log('Client "' + clientName + '" got', data);
      if (data.run) {
        var f = tests[data.test].steps[data.step];

        try {

          // Run the test function on the client
          f(function(txt) {
            var msg = JSON.stringify({
              completed: true,
              error: !!txt,
              message: txt,
              test: data.test,
              step: data.step,
              client: clientName
            });

            // Call parent to report status about test run
            parent.postMessage(msg, origin);
          });

        } catch(err) {

          // On error send error
          var msg = JSON.stringify({
            completed: true,
            error: true,
            message: err.message,
            test: data.test,
            step: data.step,
            client: clientName
          });        
          // Call parent to report status about test run
          parent.postMessage(msg, origin);
        }
      }

    } else {
      // Main communication
      console.log('Main got', data);
      
      if (data.completed) {
        testDb.insert(data);
        nextStep();
      }
    }
  }, false);
}

var currentTest = 0;
var currentStep = 0;

var nextStep = function() {
  // Get current test
  var test = tests[currentTest];

  if (currentStep < test.steps.length) {

    var target = test.steps[currentStep];

    if (target.isClient) {

      var iframe = target.iframe.contentWindow;

      var msg = JSON.stringify({
        run: true,
        step: currentStep,
        test: currentTest
      });


      console.log('MESSAGE', msg, origin);

      iframe.postMessage(msg, origin);

    }

    if (target.isServer) {
      target.connection.call('runTest', currentTest, currentStep, function(error, data) {
        if (error) {
          console.log('Server test failed', error);
        } else {
          console.log('Server test OK', data);
                // Main communication
          console.log('Main got', data);
          
          if (data.completed) {
            testDb.insert(data);
            nextStep();
          }
        }
      });
    }

    currentStep++;

  } else {
    console.log('Test ended');
  }

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
          console.log('Client', name, 'loaded');

          // Wait a bit
          Meteor.setTimeout(function() {
            // Dec waiting
            waiting--;

            // If done waiting for clients we start stepper
            if (!waiting) nextStep();
          }, 500);
        });

        iframe.src = 'test/' + name;
        console.log('Added test/'+name);

        test.clients[name] = client;
      }

      var target = test.clients[name];

      // Return the step register function
      return function(stepFunction) {
        // Store step
        test.steps.push(target);
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

        console.log('Added test', name);
        test.clients[name] = server;
      }

      var server = test.clients[name];

      return function(stepFunction) {
        test.steps.push(server);
      };
    }
  });

  // Ok we are back and should be all set to start the test...
};


var mainTestApp = function() {
  console.log('Main app');

  eachTest(function(test, index) {

    console.log('Got test: "' + test.name + '"');

  });

  // Start tests
  startTest(0);
};

var clientTestApp = function(currentName) {
  console.log('Client test app "' + currentName + '"');

  eachTest(function(test, index) {
    test.f.apply({
      Client: function(name) {
        return function(stepFunction) {
          if (name == currentName) {
            // Ok this step should run on this client
            test.steps.push(stepFunction);
          } else {
            // Noop, another client is going for this...
            test.steps.push(noop);
          }
        };
      },
      Server: function(name) {
        return function(stepFunction) {        
          // Noop, server is going for this...
          test.steps.push(noop);
        }
      }
    });
  });

};

var serverTestApp = function(currentName) {
  // Make sure we have a pretty name
  currentName = currentName || defaultServerName;

  console.log('Server test app "' + currentName + '"');

  eachTest(function(test, index) {
    test.f.apply({
      Client: function(name) {
        return function(stepFunction) {        
          // Noop, clients is going for this...
          test.steps.push(noop);        
        };
      },
      Server: function(name) {
        // Pretty name
        name = name || defaultServerName;

        return function(stepFunction) {
          if (name == currentName) {
            // Ok this step should run on this server
            test.steps.push(stepFunction);
          } else {
            // Noop, another server is going for this...
            test.steps.push(noop);
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
      mainTestApp();
    }
  }

  if (Meteor.isServer) {
    serverTestApp();
  }

});

if (Meteor.isClient) {

  Template.test_results.clientName = function(t, c) {
    return tests[t].clients[c].name;
  };

  Template.test_results.testName = function(n) {
    return tests[n].name;
  };

  Template.test_results.items = function() {
    return testDb.find();
  };

}


if (Meteor.isServer) {

  var runAsyncTask = function(test, step, callback) {
    var f = tests[test].steps[step];

    try {    
      // Run the test function on the client
      f(function(txt) {

        var msg = {
          completed: true,
          error: !!txt,
          message: txt,
          test: test,
          step: step,
          server: serverName
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
        test: test,
        step: step,
        server: serverName
      };        
      // Call parent to report status about test run
      callback(null, msg);
    }
  };

  var runSyncTask = Meteor._wrapAsync(runAsyncTask);

  Meteor.methods({
    'runTest': function(test, step) {

      console.log('Run test', test, step);
      return runSyncTask(test, step);
    }
  });
}