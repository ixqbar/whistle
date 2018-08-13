const targetServers = {
    "local" : "ws://127.0.0.1:8899/sock?uuid=" + chrome.runtime.id + "&proxy=0&monitor=1"
};

var currentTargetServer = "local";

var db = openDatabase('whistle', '1.0', 'whistle DB', 2 * 1024 * 1024);
db.transaction(function (tx) {  
   tx.executeSql('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, title VARCHAR(200) NOT NULL DEFAULT "", message TEXT NOT NULL DEFAULT "", date VARCHAR(200) NOT NULL DEFAULT "")');
});

function sendNotification(data) {
    chrome.notifications.create({
        "type": "basic",
        "title":data.title,
        "message":data.message,
        "iconUrl":"images/icon.png"
    }, function(notificationId){
        console.log(notificationId);
    });

    db.transaction(function (tx) {
        tx.executeSql('INSERT INTO logs (title, message, date) VALUES (?, ?, ?)', [data.title, data.message, (new Date()).toString()]); 
    });
}

var webSocketHandler = function() {
    this.ws = null;
    this.messages = null;
    this.opened = false;
    this.waitQueue = [];
};

webSocketHandler.prototype.Connect = function(callback) {
    if (this.ws != null) {
        if (this.opened) {
            callback.call(null, this);
        } else {
            this.waitQueue.push(callback);
        }
        return;
    }

    var _this = this;
    this.ws = new WebSocket(targetServers[currentTargetServer]);
    this.ws.addEventListener('open', function(event) {
        _this.ws.binaryType = 'arraybuffer';
        _this.opened = true;
        callback.call(null, _this);
        if (_this.waitQueue.length > 0) {
            for (var i in _this.waitQueue) {
                _this.waitQueue[i].call(null, _this);
            }
            _this.waitQueue = [];
        }
    });
    this.ws.addEventListener('close', function(event) {
        console.dir(event);
        _this.ws = null;
        _this.opened = false;
    });
    this.ws.addEventListener('error', function(event) {
        console.dir(event);
        _this.ws = null;
        _this.opened = false;
    });
    this.ws.addEventListener('message', function(event) {
        if (event.type != 'message'
            || event.data.length == 0) {
            console.log(event);
            return;
        }

        console.log(event.data);
        sendNotification(JSON.parse(event.data));
    });
};

webSocketHandler.prototype.ReOpen = function(callback) {
    this.ws.close();
    this.Connect(callback);
};

var webSocket = new webSocketHandler();

chrome.storage.local.get(['servers', 'defaultServer'], function(result){
    if (0 == Object.keys(result).length 
        || typeof result['servers'] == 'undefined'
        || result['servers'].length == 0 
        || typeof result['defaultServer'] == 'undefined'
        || result['defaultServer'].length == 0) {
       chrome.storage.local.set({'servers':targetServers, 'defaultServer': currentTargetServer}, function(){
            console.log('save default severs settings success');
       });
    }

    webSocket.Connect(function(ws) {
        console.log("connected server:" + targetServers[currentTargetServer]);
    });
});

chrome.notifications.onClosed.addListener(function(notificationId, byUserCanceled){
    console.log("closed:", notificationId, byUserCanceled);
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (sender.id != chrome.runtime.id) {
        sendResponse({"state":"fail", "message":"unknown extension id"});
        return false;
    }

    console.dir(request);

    if (typeof request['event'] == 'undefined') {
        sendResponse({"state":"fail", "message":"unknown event"});
        return false;
    }

    switch (request['event']) {
        case 'switchServer':
            if (typeof request['selectTargetServer'] == 'undefined' 
                || typeof targetServers[request['selectTargetServer']] == 'undefined' 
                || request['selectTargetServer'] == currentTargetServer) {
                console.log('invalid selectTargetServer');   
                sendResponse({"state":"fail", "message":"invalid option"});
            } else {
                chrome.storage.local.set({'defaultServer': request['selectTargetServer']}, function(){
                    console.log('save default severs settings success');
                    currentTargetServer = request['selectTargetServer'];
                    webSocket.ReOpen(function(){
                        sendResponse({"state":"ok"});
                    });
                });
            }
        break;
        case 'loadLogs':
            db.transaction(function (tx) {
                tx.executeSql('SELECT id,title,message FROM logs order by id DESC limit 50', [], function (tx, results) {
                    console.log(results.rows);
                    sendResponse({"state":"ok", "logs":results.rows});
                }, null);
            });
        break;
        case 'deleteLog':
            db.transaction(function (tx) {
                tx.executeSql('DELETE FROM logs WHERE id=?', [request['id']]);
                sendResponse({"state":"ok"});
            });
        break;
        case 'addServer':
            if (typeof request['name'] == 'undefined'
                || typeof request['url'] == 'undefined') {
                console.log('invalid server');   
                sendResponse({"state":"fail", "message":"invalid server"});
            } else {
                if (request['url'].indexOf("?") == -1) {
                    request['url'] += '?proxy=0&monitor=1';
                }
                if (request['url'].indexOf("uuid=") == -1) {
                    request['url'] += '&uuid=' + sender.id;
                }
                targetServers[request['name']] = request['url'];
                chrome.storage.local.set({'servers':targetServers}, function(){
                    console.log('save new sever settings success');
                    sendResponse({"state":"ok", "url": request['url']});
                });
            }
        break;
        case 'deleteServer':
            if (typeof request['name'] == 'undefined'
                || request['name'] == currentTargetServer) {
                console.log('invalid server');   
                sendResponse({"state":"fail", "message":"invalid server"});
            } else {
                delete targetServers[request['name']];
                chrome.storage.local.set({'servers':targetServers}, function(){
                    console.log('delete sever settings success');
                    sendResponse({"state":"ok"});
                });
            }
        break;
        default:
        sendResponse({"state":"fail", "message":"unknown event"});
        break;
    }

    return true;
});