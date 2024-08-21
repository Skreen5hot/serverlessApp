// peer to peer communication layer

class P2P {

    localPeerConnection = null; // null or RTCPeerConnection
    ready = false; // ready once peer to peer connection is estabilished

    dataChannel = null; // null or RTCDataChannel

    initPeer() {
        const stunServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:23.21.150.121:3478' },
        ];

        // create peer connection
        this.localPeerConnection = new RTCPeerConnection({
            iceServers: stunServers
        });

        // create data channel
        this.localPeerConnection.addEventListener('connectionstatechange', (state) => {
            console.log('connection state', state);
        });
        this.dataChannel = this.localPeerConnection.createDataChannel('messages');
        this.dataChannel.addEventListener('message', (msg) => {
            console.log(msg);
        });
    }

    // create peer connection offer, used by peer initializing the coomunication
    async createOffer() {
        this.ready = false;
        this.initPeer();
        try {
            // create offer
            const offer = await this.localPeerConnection.createOffer();
            await this.localPeerConnection.setLocalDescription(offer);

            // return offer
            return offer;
        } catch (error) {
            throw new Error("Error creating offer:" + error);
        }
    }

    // accept incoming offer from remote peer, used by peer receiving the connection
    async acceptOffer(sdp) {
        this.initPeer();

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

        // create answer
        const answer = await this.localPeerConnection.createAnswer();
        await this.localPeerConnection.setLocalDescription(answer);

        this.ready = true;

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
        this.ready = true;
    }

    send(message) {
        if (this.localPeerConnection === null || ! this.ready) {
            alert('P2P connection not open');
        }
        if (this.dataChannel !== null) {
            this.dataChannel.send(message);
        }
    }

    
}

const p2p = new P2P();