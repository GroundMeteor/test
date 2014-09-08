Package.describe({
  name: "ground:test",
  version: "0.1.3",
  summary: "Run sync tests on multiple clients and the server",
  // git: "https://github.com/GroundMeteor/Meteor-GroundDB.git"
});

Package.on_use(function (api) {
  if (api.versionsFrom) {
    api.versionsFrom('METEOR@0.9.1');
    api.use('meteor-platform', ['client', 'server']);

  } else {
    api.use('standard-app-packages', ['client', 'server']);
  }

  api.export('GroundTest');
  // api.export && api.export('_gDB', ['client', 'server'], {testOnly: true});
  // api.use([
  //   'meteor',
  //   'underscore',
  //   'random',
  //   'minimongo',
  //   'ejson',
  //   'ejson-minimax'
  //   ], ['client', 'server']);

  api.use('bootstrap');

  // api.use(['deps'], 'client');
  // //api.use([], 'server');
  // //api.use(['localstorage', 'ejson'], 'client');
  api.add_files(['style.css', 'template.html'], 'client');
  api.add_files('testbed.js', ['client', 'server']);
  // api.add_files('groundDB.server.js', 'server');
});

Package.on_test(function (api) {
  // api.use('grounddb', ['client']);
  // api.use('test-helpers', 'client');
  // api.use(['tinytest', 'underscore', 'ejson', 'ordered-dict',
  //          'random', 'deps']);

  // api.add_files('groundDB.client.tests.js', 'client');
  // api.add_files('groundDB.server.tests.js', 'server');
});