'use strict'

var config = require('config');
var C = require('../constants/Constants');
// EventEmitter
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var MediaController = require('./MediaController.js');

let instance = null;

module.exports = class MCSApiStub extends EventEmitter{
  constructor() {
    if(!instance) {
      super();
      this.listener = new EventEmitter();
      this._mediaController = new MediaController(this.listener);
      instance = this;
    }

    return instance;
  }

  async join (room, type, params) {
    try {
      const answer = await this._mediaController.join(room, type, params);
      return Promise.resolve(answer);
    }
    catch (err) {
      console.log(err);
      Promise.reject(err);
    }
  }

  async leave (roomId, userId) {
    try {
      const answer = await this._mediaController.leave(roomId, userId);
      return Promise.resolve(answer);
    }
    catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async publishnsubscribe (user, sourceId, sdp, params) {
    try {
      const answer = await this._mediaController.publishnsubscribe(user, sourceId, sdp, params);
      return Promise.resolve(answer);
    }
    catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async publish (user, room,  type, params) {
    try {
      this.listener.once(C.EVENT.NEW_SESSION+user, (event) => {
        let sessionId = event;
        this.listener.on(C.EVENT.MEDIA_STATE.MEDIA_EVENT+sessionId, (event) => {
          this.emit(C.EVENT.MEDIA_STATE.MEDIA_EVENT+sessionId, event);
        });
      });
      const answer = await this._mediaController.publish(user, room, type, params);
      return Promise.resolve(answer);
    }
    catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }
  
  async unpublish (user, mediaId) {
    try {
      await this._mediaController.unpublish(mediaId);
      return Promise.resolve();
    }
    catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async subscribe (user, sourceId, type, params) {
    try {
      this.listener.once(C.EVENT.NEW_SESSION+user, (event) => {
        let sessionId = event;
        this.listener.on(C.EVENT.MEDIA_STATE.MEDIA_EVENT+sessionId, (event) => {
          this.emit(C.EVENT.MEDIA_STATE.MEDIA_EVENT+sessionId, event);
        });
      });

      const answer = await this._mediaController.subscribe(user, sourceId, type, params);

      return Promise.resolve(answer);
    }
    catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async unsubscribe (user, mediaId) {
    try {
      await this._mediaController.unsubscribe(user, mediaId);
      return Promise.resolve();
    }
    catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async onEvent (eventName, mediaId) {
    try {
      const eventTag = this._mediaController.onEvent(eventName, mediaId);
      this._mediaController.on(eventTag, (event) => {
        this.emit(eventTag, event);
      });

      return Promise.resolve(eventTag);
    }
    catch (err) {
      console.log(err);
      return Promise.reject();
    }
  }

  async addIceCandidate (mediaId, candidate) {
    try {
      const ack = await this._mediaController.addIceCandidate(mediaId, candidate);
      return Promise.resolve(ack);
    }
    catch (err) {
      console.log(err);
      Promise.reject();
    }
  }
  setStrategy (strategy) {
    // TODO
  }
}
