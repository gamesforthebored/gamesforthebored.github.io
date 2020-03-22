// Bouncer wrapper code

function Bouncer(websocketAddress, callback) {
  this.websocket_ = new WebSocket(websocketAddress);
  this.websocket_.onopen = (() => {
    this.websocket_.onmessage = ((msg) => {
      let response = JSON.parse(msg.data);
      if (response.type === "YOUR_UID") {
        this.uid = response.uid;
        console.log("Connected with UID:", this.uid);
      } else if (response.type === "MEMBERS_ANSWER") {
        console.log("Members of channel", response.channel, ":", response.members);
        this.onMembers_ && this.onMembers_(response);
      } else if (response.type === "MEMBERS_REJECTED") {
        console.log("Cannot query membership of channel you are not in:", response.channel);
      } else if (response.type === "JOIN_REJECTED") {
        console.log("Cannot join channel you are already in:", response.channel);
      } else if (response.type === "QUIT_REJECTED") {
        console.log("Cannot quit channel you are not in:", response.channel);
      } else if (response.type === "HELLO") {
        console.log("User", response.uid, "has joined channel", response.channel);
        this.onHello_ && this.onHello_(response);
      } else if (response.type === "GOODBYE") {
        console.log("User", response.uid, "has quit channel", response.channel);
        this.onGoodbye_ && this.onGoodbye_(response);
      } else if (response.type === "BOUNCE") {
        console.log("Received message:", response);
        this.onReceive_ && this.onReceive_(response);
      }
    });
    this.websocket_.send(JSON.stringify({type: "MY_UID"}));
    // Keep the connection alive:
    setInterval(() => {this.websocket_.send(JSON.stringify({type: "PING"}));}, 30000);
    callback && callback();
  });
}
Bouncer.prototype.isConnected = function() {
  return this.websocket_.readyState === WebSocket.OPEN;
}
Bouncer.prototype.join = function(channelName) {
  this.websocket_.send(JSON.stringify({type: "JOIN", channel: channelName}));
}
Bouncer.prototype.quit = function(channelName) {
  this.websocket_.send(JSON.stringify({type: "QUIT", channel: channelName}));
}
Bouncer.prototype.members = function(channelName, callback) {
  this.websocket_.send(JSON.stringify({type: "MEMBERS_QUERY", channel: channelName}));
  this.onMembers_ = callback;
}
Bouncer.prototype.hello = function(onHello) {
  this.onHello_ = onHello;
}
Bouncer.prototype.goodbye = function(onGoodbye) {
  this.onGoodbye_ = onGoodbye;
}
Bouncer.prototype.receive = function(onReceive) {
  this.onReceive_ = onReceive;
}
Bouncer.prototype.send = function(message, channel) {
  this.websocket_.send(JSON.stringify({type: "SEND", channel: channel, payload: message}));
}
