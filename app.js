var restify = require('restify');
var builder = require('botbuilder');

//constants data
var port = process.env.PORT || 3011;
var msAppId = process.env.MICROSOFT_APP_ID;
var msAppPassword = process.env.MICROSOFT_APP_PASSWORD;

//Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
 
// Create chat bot
var connector = new builder.ChatConnector({appId: msAppId, appPassword: msAppPassword});
console.log(connector);
var bot = new builder.UniversalBot(connector);

server.post('/api/messages', connector.listen()); 

bot.dialog('/', function (session) {
  session.send('Provider bot in operation :-)');
//	session.send();
});