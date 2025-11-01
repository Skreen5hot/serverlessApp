// peer to peer communication layer
class P2P {
    constructor() {
        this.signalingServerURL = 'wss://signal.filonexus.com';
        this.localPeerConnection = null;
        this.dataChannel = null;
        this.isInitiator = false;
        this.isConnected = false;
        this.pendingCandidates = [];
        this.socket = new io(this.signalingServerURL);
        
        // Generate a unique user ID
        this.userId = Math.random().toString(36).substr(2, 9);
        
        this.onmessage = null;
        
        this.socket.on('connect', () => {
            console.log('Connected to signaling server with ID:', this.userId);
        });

        this.initPeer();

        // offer received from signaling server, accept and send answer
        this.socket.on('receive-offer', async (data) => {
            if (data.userId !== this.userId && !this.isInitiator) {
                console.log('Received offer as receiver');
                await this.acceptOffer(data.offer.sdp);
            }
        });

        // answer received from signalign server, accept
        this.socket.on('receive-answer', async (data) => {
            if (data.userId !== this.userId && this.isInitiator) {
                console.log('Received answer as initiator');
                await this.acceptAnswer(data.answer.sdp);
            }
        });

        // ICE candidate received from signaling server
        this.socket.on('receive-ice-candidate', async (data) => {
            if (data.userId === this.userId) return;
            
            try {
                if (this.localPeerConnection.remoteDescription) {
                    await this.localPeerConnection.addIceCandidate(data.candidate);
                    console.log('Added ICE candidate');
                } else {
                    // Store candidates until remote description is set
                    this.pendingCandidates.push(data.candidate);
                    console.log('Stored pending ICE candidate');
                }
            } catch (e) {
                console.warn('Error adding ICE candidate:', e);
            }
        });
    }

    initPeer() {
        if (this.localPeerConnection) {
            this.localPeerConnection.close();
        }
        
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 10
        };

        // Reset connection state
        this.isInitiator = false;
        this.isConnected = false;
        this.pendingCandidates = [];
        
        // create peer connection
        this.localPeerConnection = new RTCPeerConnection(config);

        // Handle incoming data channels
        this.localPeerConnection.addEventListener('datachannel', (event) => {
            console.log('Received data channel');
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers(this.dataChannel);
        });

        // received ICE candidate for local peer, send to signaling server to broadcast
        this.localPeerConnection.addEventListener('icecandidate', (ice) => {
            if (ice.candidate) {
                this.socket.emit('send-ice-candidate', {
                    userId: this.userId,
                    candidate: ice.candidate
                });
            }
        });

        // create data channel for the initiator
        if (!this.dataChannel) {
            this.dataChannel = this.localPeerConnection.createDataChannel('messages');
            console.log('Created data channel');
            this.setupDataChannelHandlers(this.dataChannel);
        }
    }

    setupDataChannelHandlers(channel) {
        channel.addEventListener('open', () => {
            console.log('Data channel is open and ready to use');
            this.isConnected = true;
        });

        channel.addEventListener('close', () => {
            console.log('Data channel closed');
            this.isConnected = false;
        });

        channel.addEventListener('message', (event) => {
            console.log('Received message:', event.data);
            if (typeof this.onmessage === 'function') {
                try {
                    const data = JSON.parse(event.data);
                    this.onmessage(data);
                } catch (e) {
                    console.error('Error parsing message:', e);
                }
            }
        });

        channel.addEventListener('error', (error) => {
            console.error('Data channel error:', error);
        });
    }

    // create peer connection offer, used by peer initializing the communication
    async createOffer() {
        try {
            if (this.localPeerConnection.signalingState !== 'stable') {
                console.log('Cannot create offer - wrong state:', this.localPeerConnection.signalingState);
                return;
            }
            
            this.isInitiator = true;
            // create offer and set it as local description
            const offer = await this.localPeerConnection.createOffer();
            await this.localPeerConnection.setLocalDescription(offer);

            console.log('created offer as initiator')

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
        if (this.isInitiator) {
            console.log('Ignoring offer - we are the initiator');
            return;
        }

        if (this.localPeerConnection.signalingState !== 'stable') {
            console.log('Cannot accept offer - wrong state:', this.localPeerConnection.signalingState);
            return;
        }

        const offer = new RTCSessionDescription({
            type: 'offer',
            sdp: `${sdp}`
        });

        // set remote description
        try {
            await this.localPeerConnection.setRemoteDescription(offer);
            console.log('Set remote description, processing pending candidates');
            
            // Add any pending ICE candidates
            while (this.pendingCandidates.length) {
                const candidate = this.pendingCandidates.shift();
                try {
                    await this.localPeerConnection.addIceCandidate(candidate);
                    console.log('Added pending ICE candidate');
                } catch (e) {
                    console.warn('Error adding pending candidate:', e);
                }
            }
        } catch(e) {
            console.error('Error setting remote description:', e);
            return;
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
        
        try {
            // Only proceed if we're in the right state
            if (this.localPeerConnection.signalingState === 'have-local-offer') {
                const answer = new RTCSessionDescription({
                    type: 'answer',
                    sdp: `${sdp}`
                });
                await this.localPeerConnection.setRemoteDescription(answer);
                console.log('answer accepted');
            } else {
                console.log('Ignoring answer - wrong state:', this.localPeerConnection.signalingState);
            }
        } catch (error) {
            console.error('Error accepting answer:', error);
        }
    }

    // send a message to connected peers
    send(message) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            console.error('Data channel is not open. Current state:', this.dataChannel?.readyState);
            return false;
        }

        try {
            const data = typeof message === 'string' ? message : JSON.stringify(message);
            this.dataChannel.send(data);
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }

    isDataChannelOpen() {
        return this.dataChannel && this.dataChannel.readyState === 'open';
    }
}

var p2p = new P2P();