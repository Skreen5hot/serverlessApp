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
                const readyStates = ['have-remote-offer', 'have-local-pranswer', 'have-remote-pranswer', 'stable'];
                if (this.localPeerConnection.remoteDescription && 
                    readyStates.includes(this.localPeerConnection.signalingState)) {
                    await this.localPeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('Added ICE candidate');
                } else {
                    // Store candidates until remote description is set
                    this.pendingCandidates.push(data.candidate);
                    console.log('Stored pending ICE candidate, current state:', this.localPeerConnection.signalingState);
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
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };

        // Reset connection state
        this.isInitiator = false;
        this.isConnected = false;
        this.pendingCandidates = [];
        
        // create peer connection
        this.localPeerConnection = new RTCPeerConnection(config);

        // Add connection state change handlers
        this.localPeerConnection.addEventListener('signalingstatechange', () => {
            console.log('Signaling State:', this.localPeerConnection.signalingState);
        });

        this.localPeerConnection.addEventListener('connectionstatechange', () => {
            console.log('Connection State:', this.localPeerConnection.connectionState);
        });

        this.localPeerConnection.addEventListener('iceconnectionstatechange', () => {
            console.log('ICE Connection State:', this.localPeerConnection.iceConnectionState);
        });

        this.localPeerConnection.addEventListener('icegatheringstatechange', () => {
            console.log('ICE Gathering State:', this.localPeerConnection.iceGatheringState);
        });

        // Handle incoming data channels
        this.localPeerConnection.addEventListener('datachannel', (event) => {
            console.log('Received remote data channel');
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers(this.dataChannel);
        });

        // Handle negotiation needed
        this.localPeerConnection.addEventListener('negotiationneeded', async () => {
            console.log('Negotiation needed event fired');
            if (this.isInitiator) {
                try {
                    await this.createOffer();
                } catch (e) {
                    console.error('Error during negotiation:', e);
                }
            }
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
            this.dataChannel = this.localPeerConnection.createDataChannel('messages', {
                ordered: true,
                negotiated: false,
                id: null
            });
            console.log('Created local data channel');
            this.setupDataChannelHandlers(this.dataChannel);
        }
    }

    async waitForDataChannel() {
        return new Promise((resolve) => {
            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (this.dataChannel && this.dataChannel.readyState === 'open') {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    setupDataChannelHandlers(channel) {
        channel.onopen = () => {
            console.log('Data channel is open and ready to use');
            this.isConnected = true;
            
            // Send a test message to verify the channel
            try {
                channel.send(JSON.stringify({ type: 'ping' }));
                console.log('Sent test ping message');
            } catch (e) {
                console.error('Error sending test message:', e);
            }
        };

        channel.onclose = () => {
            console.log('Data channel closed');
            this.isConnected = false;
            if (this.dataChannel === channel) {
                this.dataChannel = null;
            }
        };

        channel.onmessage = (event) => {
            console.log('Received message on data channel:', event.data);
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ping') {
                    console.log('Received ping, sending pong');
                    channel.send(JSON.stringify({ type: 'pong' }));
                    return;
                }
                if (data.type === 'pong') {
                    console.log('Received pong - channel verified');
                    return;
                }
                if (typeof this.onmessage === 'function') {
                    this.onmessage(data);
                }
            } catch (e) {
                console.error('Error handling message:', e);
            }
        };

        channel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.isConnected = false;
            if (this.dataChannel === channel) {
                this.dataChannel = null;
            }
        };
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
        if (!this.localPeerConnection || !this.isInitiator) {
            console.log('Not ready to accept answer');
            return;
        }
        
        try {
            if (this.localPeerConnection.signalingState === 'have-local-offer') {
                const answer = new RTCSessionDescription({
                    type: 'answer',
                    sdp: sdp
                });
                await this.localPeerConnection.setRemoteDescription(answer);
                console.log('Answer accepted, processing pending candidates');
                
                // Process any pending ICE candidates
                while (this.pendingCandidates.length) {
                    const candidate = this.pendingCandidates.shift();
                    try {
                        await this.localPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log('Added pending ICE candidate after answer');
                    } catch (e) {
                        console.warn('Error adding pending candidate after answer:', e);
                    }
                }
            } else {
                console.log('Cannot accept answer - wrong state:', this.localPeerConnection.signalingState);
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