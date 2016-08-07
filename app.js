var restify = require('restify');
var builder = require('botbuilder');
var mongoose = require('mongoose');
var apns = require("apns");
var WebSocketServer = require('ws').Server;

//constants data

var port = process.env.PORT || 3011;
var msAppId = process.env.MICROSOFT_APP_ID;
var msAppPassword = process.env.MICROSOFT_APP_PASSWORD;

var options = {
   keyFile : "cert/213.key.pem",
   certFile : "cert/213.crt.pem",
   debug : true
};
//Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

//WebSocket
var wss = new WebSocketServer({server});
wss.on('connection', function (ws) {
    console.log("WS connection add " + wss.clients.length);
    ws.on('close',function(code,message){
      console.log("WS CLOSE " + wss.clients.length);
    });
});

//APNS
var connection = new apns.Connection(options);

// Create chat bot
var connector = new builder.ChatConnector({appId: msAppId, appPassword: msAppPassword});
var bot = new builder.UniversalBot(connector);

server.post('/api/messages', connector.listen());

bot.dialog('/', botDialog);

//REST API
server.get('/', respond);
server.post('/request', handleRequestMessage);

server.use(restify.acceptParser(server.acceptable));
server.use(restify.bodyParser());
server.use(restify.authorizationParser());

server.get('/thread',getThreads);
server.get('/thread/:THREAD_ID/messages',getThreadMsgs);
server.post('/thread/:THREAD_ID/messages',postThreadMsgs);
server.post('/apns',postAPNs);
server.post('/createProvider',postCreateProvider);
server.post('/thread/:THREAD_ID/message_seen/:MSG_ID',postThreadMsgSeen);

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
function GetThreadLastMsg(threadId)
{
  var query = MsgDB.find({"ThreadId": threadId}).limit(1).select('created text').sort({"created": -1});
  return query;
};
function GetFrom(threadId)
{
  var query = ChanelDB.find().select('from');
  return query;
};

function postCreateProvider(req, res, next)
{
  res.contentType = 'application/json';
  res.charset = 'utf-8';
  console.dir(req.authorization);
  if (req.authorization==null ||
      req.authorization.basic.username == null ||
    req.authorization.basic.password == null)
  {
    res.send(401);
    return;
  }
  ProviderDB.find({"username":req.authorization.basic.username}).limit(1).exec(function(err,items){
    if (items.length == 0)
    {
      var record = new ProviderDB({"name":req.body.name});
      record.username = req.authorization.basic.username;
      record.password = req.authorization.basic.password;
      record.save();
      res.send(201);
    }
    else
    {
      res.send(401);
    }
  });


}

function getThreads(req, res, next)
{
  res.contentType = 'application/json';
  res.charset = 'utf-8';
  var result = [];
  var tmpResult = [];
  var CountLastmesage;
  var CountConsumer;
  LgetAuth();
  function LgetAuth()
  {
    var query = ProviderDB.find({"username":req.authorization.basic.username, "password":req.authorization.basic.password}).limit(1).select('_id')
    query.exec(function(err,items){
      if (items.length == 0)
        res.send(401);
      else
      {
        LgetThreads(items[0]._id);

      }
    });
  }

  function LgetThreads(providerId){
    var query = ThreadDB.find({"provider":providerId});
    query.exec(LonThreads);
  }

  function LonThreads(err,items){
    if (items.length==0)
    {
      finish();
      return;
    }
    var itemsProcessed = 0;
    items.forEach(function (item,i,items)
    {
      // console.log("forEach " + result.length);
      // console.log("itemsProcessed "+itemsProcessed);
      result.push({});
      tmpResult.push(item);
      tmpResult[i].last_seen = (item.last_seen == null)?0:item.last_seen;
      result[i].thread_id = item._id;
      //result[i].name = item.from.name;
      if (++itemsProcessed === items.length)
      {
        //console.log(tmpResult);
        LWriteOther();
      };
    });
    function LWriteOther()
    {
      tmpResult.forEach(function(item,i){
        LgetConsumer(item.consumer,i);
        LgetThreadLastMsg(item.msgs);
      });
    }

    function LgetConsumer(consumer_id,i)
    {
      // tekI = i;
      CountConsumer = 0;
      var query = ChanelDB.find({"_id":consumer_id}).limit(1);
      query.exec(LonConsumer);
    }
    function LonConsumer(err,items)
    {
      for (var i = 0; i<tmpResult.length; i++)
      {
        if (tmpResult[i].consumer != items[0]._id)
        {
          continue;
        }
        result[i].consumer = {};
        result[i].consumer.name = items[0].user.name;
        result[i].consumer.id = items[0]._id;
        result[i].consumer.type = 'consumer';
        LCheckConsumers();
        return;
      }
    }
    function LgetThreadLastMsg(msgs)
    {

      CountLastmesage = 0;
      var query = MsgDB.find().in("_id",msgs).sort({"sent": -1});
         query.exec(LonThreadLastMessage);
    }

    function LonThreadLastMessage(err,item)
    {
      // console.log(item);
      for (var i = 0; i<tmpResult.length; i++)
      {
        if (tmpResult[i].msgs.indexOf(item[0]._id)==-1)
        {
          continue;
        }
        tmpResult[i].msgs = [];
        result[i].last_message = {};
        result[i].last_message.sent = item[0].sent.getTime()/1000|0;
        result[i].last_message.type = item[0].type;
        result[i].last_message.message = item[0].message;
        result[i].last_message.sender = item[0].sender;
        result[i].last_message.id = item[0]._id;
        result[i].last_message.attachments = [];
        if (item[0].attachments!=null)
        	result[i].last_message.attachments = item[0].attachments;
        result[i].unseen_count = 0;
        for (var j = 0; j<item.length && item[j]._id>tmpResult[i].last_seen; j++)
        {
          if (item[j].fromUser == true)
            result[i].unseen_count++
        }
        result[i].last_message.unseen = (result[i].unseen_count > 0 && item[0].fromUser)?1:0;
        LCheckLastMsgs();
        return;
      }
      // console.log(result);
    }

    function LCheckLastMsgs()
    {
      CountLastmesage++;
        WaitAll();
    }
    function LCheckConsumers()
    {
      CountConsumer++;
        WaitAll();
    }
    function WaitAll()
    {
      if (CountLastmesage == result.length && CountConsumer == result.length)
        finish();
    }

    };

  function finish()
  {
      res.send(result);
  }
};

function getThreadMsgs(req, res, next)
{
  var result = {"messages":[]};
  res.contentType = 'application/json';
  res.charset = 'utf-8';
  LgetAuth();
  var last_seen = 0;
  function LgetAuth()
  {
    var query = ProviderDB.find({"username":req.authorization.basic.username, "password":req.authorization.basic.password}).limit(1).select('_id')
    query.exec(function(err,items){
      if (items.length == 0)
        res.send(401);
      else
      {
        LauthOk();
      }
    });
  }
  function LauthOk(){
    ThreadDB.find({"_id": req.params.THREAD_ID}).limit(1).exec(function(err,items){
    	last_seen = items[0].last_seen;
      findmsgs(items[0].msgs);
    });
  }
  function findmsgs(msgsId)
  {

	  MsgDB.find().in("_id",msgsId).sort({"sent":-1}).exec(function(err,items){
      //items.forEach(function(item)
    	for (var i = 0; i<items.length; i++){
    		var item = items[i];
    		result.messages.push({});
    		//var i = result.messages.length-1;
    		result.messages[i].id = item._id;
    		result.messages[i].sender = item.sender;
    		result.messages[i].type = item.type;
    		result.messages[i].message = item.message;
    		result.messages[i].attachments = item.attachments;
    		result.messages[i].sent = item.sent.getTime()/1000|0;
    		result.messages[i].unseen = (item.fromUser && item._id>last_seen)?1:0;

      };
      res.send(201,result);
    });

  }

};

function postThreadMsgs(req, res, next)
{
  var msg = new MsgDB({});
  //msg.thread_id.push(req.params.THREAD_ID);
  msg.type = req.body.type;
  msg.message = (req.body.message !=null)?req.body.message:"";
  msg.fromUser = false;
  msg.attachments = [];
  if (req.body.attachments != null)
    msg.attachments = req.body.attachments;

  LgetAuth();
  function LgetAuth()
  {
    var query = ProviderDB.find({"username":req.authorization.basic.username, "password":req.authorization.basic.password}).limit(1).select('_id')
    query.exec(function(err,items){
      if (items.length == 0)
        res.send(401);
      else
      {
        msg.sender.name = items[0].name;
        msg.sender.id = items[0]._id;
        msg.sender.type = 'provider';
        LauthOk();
      }
    });
  }
  var reply = new builder.Message();
  function LauthOk(){
     reply.text(req.body.message);
     reply.attachments(msg.attachments);
    ThreadDB.find({"_id": req.params.THREAD_ID}).limit(1).exec(function(err,items){
      findChanel(items);
    });
  }
  function findChanel(items)
  {
    msg.ChanelId = items[0].consumer;
    ChanelDB.findOne({"_id":items[0].consumer}).exec(LonThread);

  }
  function LonThread(err,item)
  {
    if (item==null)
    {
      finish(true);
      return;
    }
    reply.address(item);
    finish(false);
  }
  function finish(err)
  {
    var result = {};
    if (!err)
    {
      bot.send(reply);
      msg.save();
      ThreadDB.update({"_id":req.params.THREAD_ID},{$push:{msgs:msg._id}},function(err, num){});
      result.sent = msg.sent.getTime()/1000|0;
      result.type = msg.type;
      result.message = msg.message;
      result.id = msg._id;
      result.sender = msg.sender;
      result.attachments = msg.attachments;
      result.unseen = 0;
    }

    res.contentType = 'application/json';
    res.charset = 'utf-8';
    res.send(201,result);

  }
};

function postAPNs(req, res, next)
{
  if (req.body.token==null)
    return res.send(201);
  APNSDB.find({"token": req.body.token}).limit(1).exec(function(err,items){
    if (items.length==0)
    {
      var provider = new APNSDB({});
      provider.token = req.body.token;
      provider.save();
    }
  });
  res.send(201);
};

function postThreadMsgSeen(req, res, next)
{
	console.log("thread "+ req.params.THREAD_ID + " MSG "+req.params.MSG_ID);
	res.contentType = 'application/json';
    res.charset = 'utf-8';
	LgetAuth();
	function LgetAuth()
	{
		if (req.authorization==null)
		{
			res.send(401);
			return;
		}
		var query = ProviderDB.find({"username":req.authorization.basic.username, "password":req.authorization.basic.password}).limit(1).select('_id')
		query.exec(function(err,items){
			if (items.length == 0)
				res.send(401);
			else
			{

				LauthOk(items[0]._id);
			}
		});
	}
	function LauthOk(providerId){
		var query = ThreadDB.find({"provider":providerId,"_id":req.params.THREAD_ID}).limit(1);
		query.exec(function(err,items){
			if (err || items[0]==null)
			{
				res.send(406);
				return;
			};
			if (items[0].msgs.indexOf(req.params.MSG_ID)==-1)
	        {
	          res.send(406);
	          return;
	        }
			items[0].last_seen = req.params.MSG_ID;
			items[0].save();
			res.send(200);
		});
	}

}


//bot Functions
function botDialog(session)
{

  // var record = new ChanelDB(session.message.address);
  // //record.save();
  // sendMsg(record);
	// session.send('Provider bot in operation :-)');
  session.send();
//just test APNS
	var notification = new apns.Notification();
	notification.alert = "Hello World !";
	APNSDB.find().exec(function(err, items){
		items.forEach(function(item){
			//console.log(item.token);
			notification.device = new apns.Device(item.token);
			connection.sendNotification(notification);
		});
	});

//end test


	  var from1 = session.message;
    var recvedMsg = session.message;


    ServerMsg = 'HERE';

    //new API
    ChanelDB.findOne({ 'user.id': recvedMsg.address.user.id }, function(err, item) {
      if (err) return console.error(err);
      if (item == null)
      {
        var record = new ChanelDB(recvedMsg.address);
        record.save();
        CheckThreads(record.id,recvedMsg);
      }
      else
      {
        CheckThreads(item.id,recvedMsg);
      }
    });
    function CheckThreads(chanelId,recvedMsg)
    {
      ThreadDB.find({"consumer" : chanelId}).exec(LonFindConsumers);
      function LonFindConsumers(err,items){
        if (items.length==0)
          CreateNewThreads(chanelId,recvedMsg);
        else
        {
          var msgid = AddUserMsgInDB(chanelId,recvedMsg);
          ThreadDB.update({"consumer":chanelId},{$push:{msgs:msgid}},function(err, num){});
        }
      }

    }
    function CreateNewThreads(chanelId,recvedMsg){
      console.log("HERE1");
      var msgid = AddUserMsgInDB(chanelId,recvedMsg);
      console.log("HERE2");
      ProviderDB.find().exec(AddThread);
        function AddThread(err,items){
          console.log(items);
          items.forEach(function(item){
            var record = new ThreadDB({"consumer": chanelId, "provider": item._id, "msgs":[msgid], "last_seen":"0"});
            record.save();
            console.log("HERE "+ record);
          });
        }
    }

};
function AddUserMsgInDB(ChanelId, msg)
{
    console.log("HERE "+ ChanelId);
    console.log(msg);
    var record = new MsgDB();
    console.log("HERE1235");
    record.message = msg.text;
    console.log("HERE1235");
    record.type = 'text';
    console.log("HERE1235");
    record.ChanelId = ChanelId;
    console.log("HERE1235");
    record.sender.name = msg.address.user.name;
    console.log("HERE1235");
    record.sender.id = ChanelId;
    console.log("HERE1235");
    record.sender.type = 'consumer';
    console.log("HERE1235");
    record.fromUser = true;
    console.log("HERE1235");
    record.id = msg.id;
    console.log("HERE1235");
    record.attachments = msg.attachments;
    console.log("HERE123");
    record.save();
    console.log("HERE12");
    var record1 = JSON.parse(JSON.stringify(record));;
    record1.sent = record.sent.getTime()/1000|0;
    wss.clients.forEach(SendWSMsg);
    function SendWSMsg(client)
    {
    	var res = {"command": 'new_message',"data":record1};
    	client.send(JSON.stringify(res));
    }
    return record._id;
};

//mongoose
mongoose.connect("mongodb://test:test@ds139685.mlab.com:39685/providerbotv3");
var db = mongoose.connection;
db.on('error', console.error);
db.once('open', function()
{
  console.log("connection DB ok");
});

var SchemaChanel = new mongoose.Schema({
  /*bot:{
    id: String,
    isGroup: Boolean,
    name: String},*/
  channelId:{type: String},
  serviceUrl:{type: String},
  useAuth: {type: Boolean},
  conversation:{
    id: String,
    isGroup: Boolean,
    name: String},
  user:{
    id: String,
    isGroup: Boolean,
    name: String}
});
var SchemaMsg = new mongoose.Schema({
  ChanelId : {type: String},
  type: {type: String},
  message: {type: String},
  attachments: [],
  sender : {
      name:{type: String},
      id:{type: String},
      type:{type: String}
  },
  sent : {type: Date, default: Date.now},
  fromUser: {type: Boolean},
  id: {type: String}
});
var SchemaProvider = new mongoose.Schema({
  name: {type: String},
  username: {type: String},
  password: {type: String}
});
var SchemaAPNS = new mongoose.Schema({
  token: {type: String}
});
var SchemaThread = new mongoose.Schema({
  consumer: {type: String},
  provider: {type: String},
  msgs: [String],
  last_seen: {type: String}
});

var MsgDB = mongoose.model('MsgSchema',SchemaMsg);
var ChanelDB = mongoose.model('ChanelSchema',SchemaChanel);
var ProviderDB = mongoose.model('ProviderSchema',SchemaProvider);
var APNSDB = mongoose.model('APNSSchema',SchemaAPNS);
var ThreadDB = mongoose.model('ThreadSchema',SchemaThread);
