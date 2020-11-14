var turn_url = "96.88.47.226";
var turn_username = "tm";
var turn_credential = "nopassword";
var apphost = "ws://localhost";
var user = "Anonymous";
var name = null;
var otherUser = null;
var webrtc_capable = true;
var rtc_peer_connection = null;
var rtc_session_description = null;
var get_user_media = null;
var connect_stream_to_src = null;
if (navigator.webkitGetUserMedia) {
    rtc_peer_connection = webkitRTCPeerConnection;
    rtc_session_description = RTCSessionDescription;
    get_user_media = navigator.webkitGetUserMedia.bind(navigator);
    connect_stream_to_src = function(media_stream, media_element) {
        media_element.src = URL.createObjectURL(media_stream);
    };
} else {
    alert("You must use the Google Chrome browser to access videoconference.");
    webrtc_capable = false;
}

var call_token;
var signaling_server;
var peer_connection;
var local_stream;
var remote_stream;
var connected = false;
var ringing = false;
var ringer;

var gum_constraints = {
    "audio": true,
    "video": {
        "mandatory": {"minFrameRate" : "23"},
        "optional": [
            {"minWidth" : "1920"},
            {"minHeight" : "1080"},
            {"minWidth" : "1280"},
            {"minHeight" : "720"},
            {"minWidth" : "960"},
            {"minWidth" : "640"},
            {"minHeight" : "480"},
            {"minHeight" : "360"},
            {"minAspectRatio" : "1.7"},
            {"minAspectRatio" : "1.6"}
        ]
    }
};

function setAppHost(host) {
    apphost = host;
}

function setCallToken(token) {
    call_token = token;
}

function setTurnURL(url) {
    turn_url = url;
}

function setTurnCredential(credential) {
    turn_credential = credential;
}

function setTurnUsername(username) {
    turn_username = username;
}

function setUser(username) {
    user = username;
}

function setName(fullname) {
    name = fullname;
}

function startSession() {
    if(signaling_server == null || signaling_server.readyState == WebSocket.CLOSED)
        setup_signaling_server();
    if(!webrtc_capable) return;
    if(peer_connection == null || peer_connection.signalingState == "closed")
        peer_connection = new rtc_peer_connection({"iceServers": [
            {urls : "stun:stun.l.google.com:19302"},
            {
                urls : "turn:" + turn_url,
                username : turn_username,
                credential : turn_credential
            }
        ]});
    peer_connection.onicecandidate = function (ice_event) {
        if (ice_event.candidate) {
            var iceCandidate = JSON.stringify({
                destination: otherUser,
                type: "new_ice_candidate",
                candidate: ice_event.candidate
            });
            signaling_server.send(iceCandidate);
        }
    };
    peer_connection.onaddstream = function (event) {
        remote_stream = event.stream;
        connect_stream_to_src(event.stream, document.getElementById("remote_video"));
        setTimeout(function() {toggleID(true)}, 5000);
        connected = true;
        ringing = false;
        toggleButton("redial_button", true);
        signaling_server.send(JSON.stringify({
            destination: "server",
            type: "video call",
            description : "video start",
            message: {room: call_token, localUser: user, remoteUser: otherUser}
        }));
    };
}

function setup_signaling_server() {
    if(peer_connection == null && webrtc_capable)
        peer_connection = new rtc_peer_connection({"iceServers": [
            {urls : "stun:stun.l.google.com:19302"},
            {
                urls : "turn:" + turn_url,
                username : turn_username,
                credential : turn_credential
            }
        ]});
    if(ringer == null)
        ringer = document.getElementById("ringer");
    signaling_server = new WebSocket(apphost + "/signaling/" + call_token);
    signaling_server.onerror = log_error;
    signaling_server.onopen = function() {signaling_server.onmessage = signal_handler;};

}

function new_description_created(description) {
    peer_connection.setLocalDescription(
        description,
        function () {
            signaling_server.send(JSON.stringify({
                destination: otherUser,
                token:call_token,
                type:"new_description",
                sdp:description
            }));
        },
        log_error
    );
}

// this event happens when client recieves data from server.
function signal_handler(event)  {
    var signal = JSON.parse(event.data);
    if(signal.type === "room_ready") {
        toggleButton("call_button", true);
        if(signal.participants != null) {
            for(var p in signal.participants) {
                if(signal.participants[p] != user)
                    otherUser = signal.participants[p];
            }
        }
        if(otherUser != null) {
            toggleID(false);
        }
    } else if(signal.type === "new_ice_candidate") {
        peer_connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } else if(signal.type === "new_description") {
        peer_connection.setRemoteDescription(
            new rtc_session_description(signal.sdp),
            function() {
                if(peer_connection.remoteDescription.type == "offer") {
                    peer_connection.createAnswer(new_description_created, log_error);
                }
            },
            log_error
        );
    } else if(signal.type === "accept_call") {
        peer_connection.createOffer(new_description_created, log_error);
    } else if(signal.type === "reject_call") {
        endSession("reject call");
    } else if(signal.type === "end_call") {
        if(ringing) {
            document.getElementById("callModalLabel").innerHTML = "";
            $("#callModal").modal("hide");
            ringing = false;
            if(ringer != null) {
                ringer.pause();
            }
        }
        endSession("end call");
    } else if(signal.type === "start_call") {
        toggleButton("ringer_off", true);
        document.getElementById("callModalLabel").innerHTML = "Incoming Call from <br/>" + signal.caller;
        $("#callModal").modal();
        ringing = true;
        flash_ringer();
        if(ringer != null) {
            ringer.currentTime = 0;
            ringer.play();
        }
        toggleButton("call_button", false);
    } else if(signal.type === "redial_call") {
        endSession();
        startSession();
        setup_video(false);
    }
}

function flash_ringer() {
    answerButton = document.getElementById("answer_phone");
    if(answerButton.className == "btn btn-success")
        answerButton.className = "btn btn-default";
    else if(answerButton.className == "btn btn-default")
        answerButton.className = "btn btn-success";
    if(ringing)
        setTimeout(flash_ringer, 500);
}



function setup_video(isCaller) {
    get_user_media(gum_constraints, function (local_media_stream) {
            var vid = document.getElementById("local_video");
            local_stream = local_media_stream;
            connect_stream_to_src(local_media_stream, document.getElementById("local_video"));
            peer_connection.addStream(local_media_stream);
            vid.onloadedmetadata = repositionLocalVideo;
            toggleButton("call_button", false);
            toggleButton("end_button", true);
            toggleButton("mute_mic_button", true);
            if(isCaller) {
                var callRequest = JSON.stringify({
                    destination: otherUser,
                    type: "start_call",
                    caller: name
                });
                signaling_server.send(callRequest);

            } else {
                var callResponse = JSON.stringify({
                    destination: otherUser,
                    type: "accept_call"
                });
                signaling_server.send(callResponse);

            }
        },
        log_error
    );
}

function repositionLocalVideo() {
    var vid = document.getElementById("local_video");
    vid.style.display = "block";
}

function toggleID(hide) {
    var controls = $('#provider-id');
    if(hide) {
        controls.removeClass("controls-fade-in");
        controls.addClass("controls-fade-out");
    } else {
        controls.removeClass("controls-fade-out");
        controls.addClass("controls-fade-in");
    }
}

function endSession(desc) {
    if(local_stream != null && !local_stream.ended){
        var tracks = local_stream.getVideoTracks();
        if (tracks && tracks[0] && tracks[0].stop) tracks[0].stop();
    }
    document.getElementById("remote_video").src = "";
    document.getElementById("local_video").src = "";
    if(peer_connection != null && peer_connection.iceConnectionState != "closed")
        peer_connection.close();

    toggleButton("end_button", false);
    toggleButton("call_button", false);
    toggleButton("mute_mic_button", false);
    toggleButton("redial_button", false);
    connected = false;
    if(desc != null)
        signaling_server.send(JSON.stringify({
            destination: "server",
            type: "video call",
            description : desc,
            message: {room: call_token, localUser: user, remoteUser: otherUser}
        }));
    if(desc == "end call"){
        var httpRequest = new XMLHttpRequest();
        httpRequest.onload = function () {
            if (httpRequest.status == 200) {
                var response = JSON.parse(httpRequest.response);
                if (response.ready) {
                    toggleButton("call_button", true);
                    if (otherUser != null) {
                        toggleID(false);
                    }
                }
            }
        };
        httpRequest.open("GET", "/video/ready/" + call_token);
        httpRequest.send();
    }
}

function makeCall() {
    startSession();
    setup_video(true);
    signaling_server.send(JSON.stringify({
        destination: "server",
        type: "start_call"
    }));
}

function acceptCall() {
    ringer.pause();
    ringing = false;
    startSession();
    setup_video(false);
    signaling_server.send(JSON.stringify({
        destination: "server",
        type: "accept_call"
    }));
}

function endCall() {
    endSession("end call");
    signaling_server.send(JSON.stringify({
        destination: otherUser,
        type: "end_call"
    }));
}

function redial() {
    if(!connected)
        return;
    endSession("redial call");
    startSession();
    get_user_media(gum_constraints,
        function (local_media_stream) {
            var vid = document.getElementById("local_video");
            local_stream = local_media_stream;
            connect_stream_to_src(local_media_stream, document.getElementById("local_video"));
            peer_connection.addStream(local_media_stream);
            vid.onloadedmetadata = repositionLocalVideo;
            toggleButton("call_button", false);
            toggleButton("end_button", true);
            toggleButton("mute_mic_button", true);
            signaling_server.send(JSON.stringify({
                destination: otherUser,
                type: "redial_call"
            }));
        },
        log_error
    );
}

function rejectCall() {
    ringer.pause();
    ringing = false;
    signaling_server.send(JSON.stringify({
        destination: otherUser,
        type: "reject_call"
    }));
    var httpRequest = new XMLHttpRequest();
    httpRequest.onload = function () {
        if (httpRequest.status == 200) {
            var response = JSON.parse(httpRequest.response);
            if (response.ready) {
                toggleButton("call_button", true);
                if (otherUser != null) {
                    toggleID(false);
                }
            }
        }
    };
    httpRequest.open("GET", "/video/ready/" + call_token);
    httpRequest.send();
}

function toggleButton(btnID, enable) {
    var btn = document.getElementById(btnID);
    if(btn == null) return;
    if(enable) {
        btn.className = "btn btn-success";
        btn.disabled = false;
        if(btnID === "call_button")
            btn.onclick = makeCall;
        else if(btnID === "end_button") {
            btn.className = "btn btn-danger";
            btn.onclick = endCall;
        } else if(btnID === "mute_mic_button") {
            btn.onclick = muteMic;
        } else if(btnID === "redial_button") {
            btn.onclick = redial;
        } else if(btnID === "ringer_off") {
            btn.className = "btn btn-warning";
            btn.onclick = stopRinger;
        }
    } else {
        btn.className = "btn btn-default";
        btn.disabled = true;
        btn.onclick = null;
    }
}

function log_error(error) {
    console.log(error);
}

function muteMic() {
    if(local_stream && local_stream.getAudioTracks().length > 0) {
        local_stream.getAudioTracks()[0].enabled = !local_stream.getAudioTracks()[0].enabled;
        if(local_stream.getAudioTracks()[0].enabled) {
            toggleButton("mute_mic_button", true);
            console.info ("Mute mic clicked");
            signaling_server.send(JSON.stringify({
                destination: "server",
                type: "mic_enable"
            }));

        } else {
            document.getElementById("mute_mic_button").className = "btn btn-danger";
            signaling_server.send(JSON.stringify({
                destination: "server",
                type: "mic_disable"
            }));
        }
    }
}

function stopRinger() {
    if(ringer != null)
        ringer.pause();
    toggleButton("ringer_off", false);
    signaling_server.send(JSON.stringify({
        destination: "server",
        type: "mute_ring"
    }));
}