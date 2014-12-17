Package.describe({
  name: "ground:test",
  version: "0.1.8",
  summary: "Run sync tests on multiple clients and the server",
  git: "https://github.com/GroundMeteor/test.git"
});

Package.onUse(function (api) {
  api.versionsFrom('1.0');
  api.use('meteor-platform', ['client', 'server']);

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

  api.use('bootstrap@1.0.1');

  // api.use(['deps'], 'client');
  // //api.use([], 'server');
  // //api.use(['localstorage', 'ejson'], 'client');
  api.addFiles(['style.css', 'template.html'], 'client');
  api.addFiles('testbed.js', ['client', 'server']);
  // api.addFiles('groundDB.server.js', 'server');
});

Package.onTest(function (api) {
  // api.use('grounddb', ['client']);
  // api.use('test-helpers', 'client');
  // api.use(['tinytest', 'underscore', 'ejson', 'ordered-dict',
  //          'random', 'deps']);

  // api.addFiles('groundDB.client.tests.js', 'client');
  // api.addFiles('groundDB.server.tests.js', 'server');
});
