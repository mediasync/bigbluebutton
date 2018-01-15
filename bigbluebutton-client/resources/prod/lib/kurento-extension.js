var isFirefox = typeof window.InstallTrigger !== 'undefined';
var isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
var isChrome = !!window.chrome && !isOpera;
var isSafari = navigator.userAgent.indexOf("Safari") >= 0 && !isChrome;
var kurentoHandler = null;

Kurento = function (
    tag,
    voiceBridge,
    conferenceUsername,
    internalMeetingId,
    onFail = null,
    chromeExtension = null
    ) {

  this.ws = null;
  this.video;
  this.screen;
  this.webRtcPeer;
  this.extensionInstalled = false;
  this.screenConstraints = {};
  this.mediaCallback = null;

  this.voiceBridge = voiceBridge + '-SCREENSHARE';
  this.internalMeetingId = internalMeetingId;

  this.vid_width = window.screen.width;
  this.vid_height = window.screen.height;

  // TODO properly generate a uuid
  this.sessid = Math.random().toString();

  this.renderTag = 'remote-media';

  this.caller_id_name = conferenceUsername;
  this.caller_id_number = conferenceUsername;

  this.kurentoPort = "bbb-webrtc-sfu";
  this.hostName = window.location.hostname;
  this.socketUrl = 'wss://' + this.hostName + '/' + this.kurentoPort;

  this.iceServers = null;

  if (chromeExtension != null) {
    this.chromeExtension = chromeExtension;
    window.chromeExtension = chromeExtension;
  }

  if (onFail != null) {
    this.onFail = Kurento.normalizeCallback(onFail);
  } else {
    var _this = this;
    this.onFail = function () {
      _this.logError('Default error handler');
    };
  }
};

this.KurentoManager= function () {
  this.kurentoVideo = null;
  this.kurentoScreenshare = null;
};

KurentoManager.prototype.exitScreenShare = function () {
  console.log("  [exitScreenShare] Exiting screensharing");
  if(typeof this.kurentoScreenshare !== 'undefined' && this.kurentoScreenshare) {
    if(this.kurentoScreenshare.ws !== null) {
      this.kurentoScreenshare.ws.onclose = function(){};
      this.kurentoScreenshare.ws.close();
    }

    this.kurentoScreenshare.disposeScreenShare();
    this.kurentoScreenshare = null;
  }

  if (this.kurentoScreenshare) {
    this.kurentoScreenshare = null;
  }

  if(typeof this.kurentoVideo !== 'undefined' && this.kurentoVideo) {
    this.exitVideo();
  }
};

KurentoManager.prototype.exitVideo = function () {
  console.log("  [exitScreenShare] Exiting screensharing viewing");
  if(typeof this.kurentoVideo !== 'undefined' && this.kurentoVideo) {
    if(this.kurentoVideo.ws !== null) {
      this.kurentoVideo.ws.onclose = function(){};
      this.kurentoVideo.ws.close();
    }

    this.kurentoVideo.disposeScreenShare();
    this.kurentoVideo = null;
  }

  if (this.kurentoVideo) {
    this.kurentoVideo = null;
  }
};

KurentoManager.prototype.shareScreen = function (tag) {
  this.exitScreenShare();
  var obj = Object.create(Kurento.prototype);
  Kurento.apply(obj, arguments);
  this.kurentoScreenshare = obj;
  this.kurentoScreenshare.setScreenShare(tag);
};

KurentoManager.prototype.joinWatchVideo = function (tag) {
  this.exitVideo();
  var obj = Object.create(Kurento.prototype);
  Kurento.apply(obj, arguments);
  this.kurentoVideo = obj;
  this.kurentoVideo.setWatchVideo(tag);
};


Kurento.prototype.setScreenShare = function (tag) {
  this.mediaCallback = this.makeShare.bind(this);
  this.create(tag);
};

Kurento.prototype.create = function (tag) {
  this.setRenderTag(tag);
  this.iceServers = true;
  this.init();
};

Kurento.prototype.init = function () {
  var self = this;
  if("WebSocket" in window) {
    console.log("this browser supports websockets");
    this.ws = new WebSocket(this.socketUrl);

    this.ws.onmessage = this.onWSMessage.bind(this);
    this.ws.onclose = (close) => {
      kurentoManager.exitScreenShare();
      self.onFail("Websocket connection closed");
    };
    this.ws.onerror = (error) => {
      kurentoManager.exitScreenShare();
      self.onFail("Websocket connection error");
    };
    this.ws.onopen = function () {
      self.mediaCallback();
    }.bind(self);
  }
  else
    console.log("this browser does not support websockets");
};

Kurento.prototype.onWSMessage = function (message) {
  var parsedMessage = JSON.parse(message.data);
  switch (parsedMessage.id) {

    case 'presenterResponse':
      this.presenterResponse(parsedMessage);
      break;
    case 'viewerResponse':
      this.viewerResponse(parsedMessage);
      break;
    case 'stopSharing':
      kurentoManager.exitScreenShare();
      break;
    case 'iceCandidate':
      this.webRtcPeer.addIceCandidate(parsedMessage.candidate);
      break;
    default:
      console.error('Unrecognized message', parsedMessage);
  }
};

Kurento.prototype.setRenderTag = function (tag) {
  this.renderTag = tag;
};

Kurento.prototype.presenterResponse = function (message) {
  if (message.response != 'accepted') {
    var errorMsg = message.message ? message.message : 'Unknown error';
    console.warn('Call not accepted for the following reason: ' + JSON.stringify(errorMsg, null, 2));
    kurentoManager.exitScreenShare();
    this.onFail(errorMessage);
  } else {
    console.log("Presenter call was accepted with SDP => " + message.sdpAnswer);
    this.webRtcPeer.processAnswer(message.sdpAnswer);
  }
}

Kurento.prototype.viewerResponse = function (message) {
  if (message.response != 'accepted') {
    var errorMsg = message.message ? message.message : 'Unknown error';
    console.warn('Call not accepted for the following reason: ' + errorMsg);
    kurentoManager.exitScreenShare();
    this.onFail(errorMessage);
  } else {
    console.log("Viewer call was accepted with SDP => " + message.sdpAnswer);
    this.webRtcPeer.processAnswer(message.sdpAnswer);
  }
}

Kurento.prototype.serverResponse = function (message) {
  if (message.response != 'accepted') {
    var errorMsg = message.message ? message.message : 'Unknow error';
    console.warn('Call not accepted for the following reason: ' + errorMsg);
    kurentoManager.exitScreenShare();
  } else {
    this.webRtcPeer.processAnswer(message.sdpAnswer);
  }
}

Kurento.prototype.makeShare = function() {
  var self = this;
  if (!this.webRtcPeer) {
    var options = {
      onicecandidate : self.onIceCandidate.bind(self)
    }

    this.startScreenStreamFrom();
  }
}

Kurento.prototype.onOfferPresenter = function (error, offerSdp) {
  let self = this;
  if(error)  {
    console.log("Kurento.prototype.onOfferPresenter Error " + error);
    this.onFail(error);
    return;
  }

  var message = {
    id : 'presenter',
    type: 'screenshare',
    role: 'presenter',
    internalMeetingId: self.internalMeetingId,
    voiceBridge: self.voiceBridge,
    callerName : self.caller_id_name,
    sdpOffer : offerSdp,
    vh: self.vid_height,
    vw: self.vid_width
  };
  console.log("onOfferPresenter sending to screenshare server => " + JSON.stringify(message, null, 2));
  this.sendMessage(message);
}

Kurento.prototype.startScreenStreamFrom = function () {
  var self = this;
  if (!!window.chrome) {
    if (!self.chromeExtension) {
      self.logError({
        status:  'failed',
        message: 'Missing Chrome Extension key',
      });
      self.onFail();
      return;
    }
  }
  // TODO it would be nice to check those constraints
  if (typeof screenConstraints !== undefined) {
    self.screenConstraints = {};
  }
  self.screenConstraints.video = {};

  console.log(self);
  var options = {
    localVideo: document.getElementById(this.renderTag),
    onicecandidate : self.onIceCandidate.bind(self),
    mediaConstraints : self.screenConstraints,
    sendSource : 'desktop'
  };

  console.log(" Peer options => " + JSON.stringify(options, null, 2));

  self.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(error) {
    if(error)  {
      console.log("WebRtcPeerSendonly constructor error " + JSON.stringify(error, null, 2));
      self.onFail(error);
      return kurentoManager.exitScreenShare();
    }

    self.webRtcPeer.generateOffer(self.onOfferPresenter.bind(self));
    console.log("Generated peer offer w/ options "  + JSON.stringify(options));
  });
}

Kurento.prototype.onIceCandidate = function (candidate) {
  let self = this;
  console.log('Local candidate' + JSON.stringify(candidate));

  var message = {
    id : 'onIceCandidate',
    role: 'presenter',
    type: 'screenshare',
    voiceBridge: self.voiceBridge,
    candidate : candidate
  }
  this.sendMessage(message);
}

Kurento.prototype.onViewerIceCandidate = function (candidate) {
  let self = this;
  console.log('Viewer local candidate' + JSON.stringify(candidate));

  var message = {
    id : 'viewerIceCandidate',
    role: 'viewer',
    type: 'screenshare',
    voiceBridge: self.voiceBridge,
    candidate : candidate,
    callerName: self.caller_id_name
  }
  this.sendMessage(message);
}

Kurento.prototype.setWatchVideo = function (tag) {
  this.useVideo = true;
  this.useCamera = 'none';
  this.useMic = 'none';
  this.mediaCallback = this.viewer;
  this.create(tag);
};

Kurento.prototype.viewer = function () {
  var self = this;
  if (!this.webRtcPeer) {

    var options = {
      remoteVideo: document.getElementById(this.renderTag),
      onicecandidate : this.onViewerIceCandidate.bind(this)
    }

    self.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function(error) {
      if(error) {
        return self.onFail(error);
      }

      this.generateOffer(self.onOfferViewer.bind(self));
    });
  }
};

Kurento.prototype.onOfferViewer = function (error, offerSdp) {
  let self = this;
  if(error)  {
    console.log("Kurento.prototype.onOfferViewer Error " + error);
    return this.onFail();
  }
  var message = {
    id : 'viewer',
    type: 'screenshare',
    role: 'viewer',
    internalMeetingId: self.internalMeetingId,
    voiceBridge: self.voiceBridge,
    callerName : self.caller_id_name,
    sdpOffer : offerSdp
  };

  console.log("onOfferViewer sending to screenshare server => " + JSON.stringify(message, null, 2));
  this.sendMessage(message);
};

Kurento.prototype.stop = function() {
  //if (this.webRtcPeer) {
  //  var message = {
  //    id : 'stop',
  //    type : 'screenshare',
  //    voiceBridge: kurentoHandler.voiceBridge
  //  }
  //  kurentoHandler.sendMessage(message);
  //  kurentoHandler.disposeScreenShare();
  //}
}

Kurento.prototype.dispose = function() {
  if (this.webRtcPeer) {
    this.webRtcPeer.dispose();
    this.webRtcPeer = null;
  }
}

Kurento.prototype.disposeScreenShare = function() {
  if (this.webRtcPeer) {
    this.webRtcPeer.dispose();
    this.webRtcPeer = null;
  }
}

Kurento.prototype.sendMessage = function(message) {
  var jsonMessage = JSON.stringify(message);
  console.log('Sending message: ' + jsonMessage);
  this.ws.send(jsonMessage);
}

Kurento.prototype.logger = function (obj) {
  console.log(obj);
};

Kurento.prototype.logError = function (obj) {
  console.error(obj);
};


Kurento.normalizeCallback = function (callback) {
  if (typeof callback == 'function') {
    return callback;
  } else {
    console.log(document.getElementById('BigBlueButton')[callback]);
    return function (args) {
      document.getElementById('BigBlueButton')[callback](args);
    };
  }
};

/* Global methods */

// this function explains how to use above methods/objects
window.getScreenConstraints = function(sendSource, callback) {
  let chromeMediaSourceId = sendSource;
  let screenConstraints = {video: {}};

  if(isChrome) {
    getChromeScreenConstraints ((constraints) => {
      let sourceId = constraints.streamId;

      // this statement sets gets 'sourceId" and sets "chromeMediaSourceId"
      screenConstraints.video.chromeMediaSource = { exact: [sendSource]};
      screenConstraints.video.chromeMediaSourceId = sourceId;
      console.log("getScreenConstraints for Chrome returns => ");
      console.log(screenConstraints);
      // now invoking native getUserMedia API
      callback(null, screenConstraints);

    }, chromeExtension);
  }
  else if (isFirefox) {
    screenConstraints.video.mediaSource= "window";
    screenConstraints.video.width= {max: "1280"};
    screenConstraints.video.height = {max:  "720"};

    console.log("getScreenConstraints for Firefox returns => ");
    console.log(screenConstraints);
    // now invoking native getUserMedia API
    callback(null, screenConstraints);
  }
  else if(isSafari) {
    screenConstraints.video.mediaSource= "screen";
    screenConstraints.video.width= {max: window.screen.width};
    screenConstraints.video.height = {max:  window.screen.vid_height};

    console.log("getScreenConstraints for Safari returns => ");
    console.log(screenConstraints);
    // now invoking native getUserMedia API
    callback(null, screenConstraints);
  }
}

window.kurentoInitialize = function () {
  if (window.kurentoManager == null || window.KurentoManager == undefined) {
    window.kurentoManager = new KurentoManager();
  }
};

window.kurentoShareScreen = function() {
  window.kurentoInitialize();
  window.kurentoManager.shareScreen.apply(window.kurentoManager, arguments);
};


window.kurentoExitScreenShare = function () {
  window.kurentoInitialize();
  window.kurentoManager.exitScreenShare();
};

window.kurentoWatchVideo = function () {
  window.kurentoInitialize();
  window.kurentoManager.joinWatchVideo.apply(window.kurentoManager, arguments);
};

window.kurentoExitVideo = function () {
  window.kurentoInitialize();
  window.kurentoManager.exitVideo();
}

window.getChromeScreenConstraints = function(callback, extensionId) {
  chrome.runtime.sendMessage(extensionId, {
    getStream: true,
    sources: [
      "window",
      "screen",
      "tab"
    ]},
    function(response) {
      console.log(response);
      callback(response);
    });
};;
