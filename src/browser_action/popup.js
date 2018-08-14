$(function(){
    console.log('popup start finished');

    var addDeleteLogEvent = false;
    var loadingDataReady = false;
    var loadingAnimReady = false;
    var loadingAnimRunning = false;
    var currentTargetServer = 'local';
    var stage  = new createjs.Stage("stage");
    var bitmap;
    var image = new Image();
    image.src = "../images/loading.png";
    image.onload = function(event) {
        bitmap = new createjs.Bitmap(event.target);
        var x = bitmap.getBounds().width / 2;
        var y = bitmap.getBounds().height / 2;
        bitmap.x = x;
        bitmap.y = y;
        bitmap.regX = x;
        bitmap.regY = y;
        bitmap.name = "loading";

        createjs.Ticker.addEventListener("tick", function(event) {
            if (stage.getChildByName("loading") == null) return;
            bitmap.rotation += 5;
            stage.update();
        });

        loadingAnimReady = true;
    };

    function toShowLoading() {
        if (loadingAnimReady == false) {
            return;
        }
        if (loadingAnimRunning) return;
        loadingAnimRunning = true;
        stage.addChild(bitmap);
        stage.update();
    }

    function toHideLoading() {
        if (loadingAnimReady == false) {
            return;
        }
        loadingAnimRunning = false;
        stage.removeChild(bitmap);
        stage.update();
    }

    function deleteLogEvent() {
        if (addDeleteLogEvent) return;
        addDeleteLogEvent = true;
        $('#output button').click(function(){
            var id = $(this).data('id');
            toShowLoading();
            chrome.runtime.sendMessage({"event":"deleteLog", "id":id}, function(response) {
                toHideLoading();
                console.dir(response);
                if (typeof response == 'undefined' 
                    || typeof response['state'] == 'undefined' 
                    || response['state'] != 'ok') {
                    return;
                }

                $('#log' + id).remove();
            });
        });
    }

    function loadLogs() {
        toShowLoading();
        chrome.runtime.sendMessage({"event":"loadLogs"}, function(response) {
            toHideLoading();
            console.dir(response);
            if (typeof response == 'undefined' 
                || typeof response['state'] == 'undefined' 
                || response['state'] != 'ok') {
                return;
            }

            for (var i in response.logs) {
                $('#output').append('<li id="log'+response.logs[i].id+'">' + response.logs[i].message + ' <button data-id="'+response.logs[i].id+'">删除</button></li>')
            }

            deleteLogEvent();
        });
    }

    chrome.storage.local.get(['servers', 'defaultServer'], function(result){
        console.log(result);

        if (0 == Object.keys(result).length 
            || typeof result['servers'] == 'undefined'
            || result['servers'].length == 0 
            || typeof result['defaultServer'] == 'undefined'
            || result['defaultServer'].length == 0) {
            toShowLoading();
            return;
        }
        
        currentTargetServer = result['defaultServer'];
        for (var key in result['servers']) {
            if (key == currentTargetServer) {
                $('#selectTargetServer').append('<option id="serverF'+ key +'" value="' + key + '" selected>' + result['servers'][key] + '</option>');
            } else {
                $('#selectTargetServer').append('<option id="serverF'+ key +'" value="' + key + '">' + result['servers'][key] + '</option>');
            }
        }

        loadingDataReady = true;
    });

    $('#selectTargetServer').change(function(){
        console.log('changed');
        if ($(this).val() == currentTargetServer) {
            $('#doSave').removeClass('button-enabled').addClass('button-disabled').attr('disabled','disabled');
        } else {
            $('#doSave').removeClass('button-disabled').addClass('button-enabled').removeAttr('disabled');
            $('#doDelete').removeClass('button-disabled').addClass('button-enabled').removeAttr('disabled');
        }
    });

    $('#doSave').click(function(){
        if (loadingDataReady == false) {
            return;
        }

        var selectTargetServer = $('#selectTargetServer').val();
        console.log(selectTargetServer);
        if (selectTargetServer == currentTargetServer) {
            return;
        }

        toShowLoading();
        chrome.runtime.sendMessage({"event":"switchServer", "selectTargetServer": selectTargetServer}, function(response) {
            toHideLoading();
            console.dir(response);
            if (typeof response == 'undefined' 
                || typeof response['state'] == 'undefined' 
                || response['state'] != 'ok') {
                $('#selectTargetServer option[value=' + currentTargetServer + ']').attr('selected', 'selected');
                $('#doSave').removeClass('button-enabled').addClass('button-disabled').attr('disabled','disabled');
                $('#doDelete').removeClass('button-enabled').addClass('button-disabled').attr('disabled','disabled');
                return;
            } else {
                $('#output').val('');
                currentTargetServer = selectTargetServer;
            }
        });
    });

    $('#doDelete').click(function(){
        var selectTargetServer = $('#selectTargetServer').val();
        console.log(selectTargetServer);
        if (selectTargetServer == currentTargetServer) {
            return;
        }

        toShowLoading();
        chrome.runtime.sendMessage({"event":"deleteServer", "name": selectTargetServer}, function(response) {
            toHideLoading();
            console.dir(response);
            if (typeof response == 'undefined' 
                || typeof response['state'] == 'undefined' 
                || response['state'] != 'ok') {
                //
            } else {
                $('#serverF' + selectTargetServer).remove();
            }

            $('#selectTargetServer option[value=' + currentTargetServer + ']').attr('selected', 'selected');
            $('#doSave').removeClass('button-enabled').addClass('button-disabled').attr('disabled','disabled');
            $('#doDelete').removeClass('button-enabled').addClass('button-disabled').attr('disabled','disabled');
        });
    });

    $('#doAdd').click(function(){
        var name = $('#serverName').val();
        var url = $('#serverUrl').val();
        if (name.length == 0 
            || url.length == 0 
            || (url.indexOf("ws://") == -1 && url.indexOf("wss://") == -1)) {
            console.log("name or url invalid");    
            return;
        }

        if (url.indexOf("ws://") != -1 && url.length == "ws://".length) {
            console.log("url invalid");    
            return;
        }

        if (url.indexOf("wss://") != -1 && url.length == "wss://".length) {
            console.log("url invalid");    
            return;
        }

        toShowLoading();
        chrome.runtime.sendMessage({"event":"addServer", "name": name, "url":url}, function(response) {
            toHideLoading();
            console.dir(response);
            if (typeof response == 'undefined' 
                || typeof response['state'] == 'undefined' 
                || typeof response['url'] == 'undefined' 
                || response['state'] != 'ok' 
                || response['url'].length == 0) {
                return;
            } else {
                $('#selectTargetServer').append('<option id="serverF'+ name +'" value="' + name + '">' + response['url'] + '</option>');
            }
            $('#options').toggle();
        });
    });

    $('#doRefresh').click(function(){
        $('#output').html('');
        loadLogs();
    });

    $('#server').click(function(){
        $('#options').toggle();
    });

    loadLogs();
});