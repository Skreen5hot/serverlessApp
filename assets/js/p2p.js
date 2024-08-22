// peer to peer communication layer
class P2P {

    signalingServerURL = 'https://dev.fandaws.com:3888';
    // signalingServerURL = 'http://localhost:3888';
    localPeerConnection = null; // null or RTCPeerConnection

    dataChannel = null; // null or RTCDataChannel

    socket = new io(this.signalingServerURL);

    // unique user id used for signaling in order to ignore own messages
    userId = Math.round(Math.random() * 1000000);

    onmessage = null; // if a function is assigned, it will be called whenever a message is received from peers

    constructor() {
        this.initPeer();
        // offer received from signaling server, accept and send answer
        this.socket.on('receive-offer', async (data) => {
            if (data.userId !== this.userId) {
                await this.acceptOffer(data.offer.sdp);
            }
        });

        // answer received from signalign server, accept
        this.socket.on('receive-answer', async (data) => {
            if (data.userId !== this.userId) {
                await this.acceptAnswer(data.answer.sdp);
            }
        });

        // ICE candidate received from signalign server, add it
        this.socket.on('receive-ice-candidate', async (data) => {
            if (data.userId !== this.userId) {
                this.localPeerConnection.addIceCandidate(data.candidate);
            }
        });
    }

    initPeer() {
        const stunServers = [
            { urls: 'stun:23.21.150.121:3478' },
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ];

        // create peer connection
        this.localPeerConnection = new RTCPeerConnection({
            iceServers: stunServers
        });

        // data channel created (by local or remote peer)
        this.localPeerConnection.addEventListener('datachannel', (channel) => {
            channel.channel.addEventListener('message', (msg) => {
                console.log(msg);
                if (typeof this.onmessage === 'function') {
                    this.onmessage(JSON.parse(msg.data));
                }
            });
        });

        // received ICE candidate for local peer, send to signalign server to broadcast
        this.localPeerConnection.addEventListener('icecandidate', (ice) => {
            if (ice.candidate) {
                this.socket.emit('send-ice-candidate', {
                    userId: this.userId,
                    candidate: ice.candidate
                });
            }
        });

        // create data channel
        this.dataChannel = this.localPeerConnection.createDataChannel('messages');
    }

    // create peer connection offer, used by peer initializing the coomunication
    async createOffer() {
        try {
            // create offer and set it as local description
            const offer = await this.localPeerConnection.createOffer();
            await this.localPeerConnection.setLocalDescription(offer);

            console.log('created offer')

            // send offer to signaling server
            this.socket.emit('send-offer', {
                userId: this.userId,
                offer
            });

            // return the offer
            return offer;
        } catch (error) {
            throw new Error("Error creating offer:" + error);
        }
    }

    // accept incoming offer from remote peer, used by peer receiving the connection
    async acceptOffer(sdp) {
        // this.initPeer();

        const offer = new RTCSessionDescription({
            type: 'offer',
            sdp: `${sdp}`
        });

        // set remote description
        try {
            await this.localPeerConnection.setRemoteDescription(offer);
        } catch(e) {
            alert(e);
        }

        // create answer and set it as local description
        const answer = await this.localPeerConnection.createAnswer();
        await this.localPeerConnection.setLocalDescription(answer);

        console.log('offer accepted')

        // send answer to signalign server
        this.socket.emit('send-answer', {
            userId: this.userId,
            answer
        });

        // return answer
        return answer;
    }

    // after receiving peer accepted the offer, they get the answer SDP
    // this is used by initializing peer to accept the answer, after which
    // the peer to peer connection is ready
    async acceptAnswer(sdp) {
        if (this.localPeerConnection === null) {return;}
        const offer = new RTCSessionDescription({
            type: 'answer',
            sdp: `${sdp}`
        });
        this.localPeerConnection.setRemoteDescription(offer);
        console.log('answer accepted');
    }

    // send a message to connected peers
    send(message) {
        if (this.localPeerConnection === null) {
            alert('P2P connection not open');
        }
        if (this.dataChannel !== null && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(typeof message === 'string' ? message : JSON.stringify(message));
        } else {
            console.log('data channel not initialized')
        }
    }

    
}

const p2p = new P2P();