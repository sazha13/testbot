var restify = require('restify');
var builder = require('botbuilder');
var mongoose = require('mongoose');

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
var bot = new builder.UniversalBot(connector);

server.post('/api/messages', connector.listen()); 

bot.dialog('/', botDialog);

//REST API
server.get('/', respond);
server.post('/request', handleRequestMessage);

//server.use(restify.acceptParser(server.acceptable));
//server.use(restify.bodyParser());
//server.use(restify.authorizationParser());
//
//server.get('/thread',getThreads);
//server.get('/thread/:THREAD_ID/messages',getThreadMsgs);
//server.post('/thread/:THREAD_ID/messages',postThreadMsgs);
//server.post('/apns',postAPNs);
//server.post('/createProvider',postCreateProvider);
//server.post('/thread/:THREAD_ID/message_seen/:MSG_ID',postThreadMsgSeen);

//REST API functions
var servermsg = " HERE";
function respond(req, res, next) 
{
	  res.contentType = "text/plain";
	  res.send(servermsg);
	  next();
}
function handleRequestMessage(req, res, next) 
{
	  res.send('POST API Response!!!');
	  next();
}
//bot Functions
function botDialog(session)
{
//	console.log(session.message.address);
	servermsg = JSON.stringify(session);
	session.send('Provider bot in operation :-)');
	
}
//mongoose
mongoose.connect("mongodb://test:test@ds139685.mlab.com:39685/providerbotv3");
var db = mongoose.connection;
db.on('error', console.error);
db.once('open', function() 
{
  console.log("connection DB ok");
});