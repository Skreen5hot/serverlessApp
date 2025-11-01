// peer to peer communication layer
window.P2P = {
    init: function() {
        // Connection settings
        this.signalingServerURL = 'wss://signal.filonexus.com';
        this.isInitiator = false;
        
        // WebRTC state
        this.localPeerConnection = null;
        this.dataChannel = null;
        this.pendingCandidates = [];
        
        // Connection state flags
        this.isConnected = false;
        this.channelReady = false;
        this.isNegotiating = false;
        
        // Event handlers
        this.onmessage = null;
        this.onchannelopen = null;
        this.onchannelclose = null;
        this.onconnectionstatechange = null;
        
        // Setup socket connection
        this.socket = new io(this.signalingServerURL);
        
        // Generate a unique user ID
        this.userId = Math.random().toString(36).substr(2, 9);
        
        this.socket.on('connect', () => {
            console.log('Connected to signaling server with ID:', this.userId);
            // Emit join event to notify signaling server
            this.socket.emit('join', { userId: this.userId });
        });

        // When another peer joins
        this.socket.on('peer-joined', (data) => {
            if (data.userId !== this.userId) {
                console.log('Peer joined:', data.userId);
                this.isInitiator = true;
                this.initPeer();
            }
        });

        // offer received from signaling server, accept and send answer
        this.socket.on('receive-offer', async (data) => {
            if (data.userId !== this.userId) {
                console.log('Received offer as receiver');
                if (!this.localPeerConnection) {
                    this.initPeer();
                }
                await this.acceptOffer(data.offer);
            }
        });

        // answer received from signaling server, accept
        this.socket.on('receive-answer', async (data) => {
            if (data.userId !== this.userId && this.isInitiator) {
                console.log('Received answer as initiator');
                await this.acceptAnswer(data.answer);
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
    },

    initPeer: function() {
        if (this.localPeerConnection) {
            this.localPeerConnection.close();
            this.localPeerConnection = null;
        }
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }

        // Reset state
        this.isConnected = false;
        this.channelReady = false;
        this.pendingCandidates = [];
        
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 0,
            // Use 'balanced' to avoid requiring an explicit BUNDLE group in the SDP
            // 'max-bundle' can cause setLocalDescription to fail when the generated
            // SDP doesn't include a BUNDLE group (common in datachannel-only offers).
            bundlePolicy: 'balanced',
            rtcpMuxPolicy: 'require'
        };

        // Reset connection state
        this.isInitiator = false;
        this.isConnected = false;
        this.pendingCandidates = [];
        this.dataChannel = null;
        
        // create peer connection
        this.localPeerConnection = new RTCPeerConnection(config);

        // Add connection state change handlers
        this.localPeerConnection.addEventListener('signalingstatechange', () => {
            console.log('Signaling State:', this.localPeerConnection.signalingState);
        });
        
        this.localPeerConnection.addEventListener('connectionstatechange', () => {
            const state = this.localPeerConnection.connectionState;
            console.log('Connection state changed:', state);
            
            if (typeof this.onconnectionstatechange === 'function') {
                this.onconnectionstatechange(state);
            }
            
            if (state === 'connected') {
                this.isConnected = true;
                // Process any pending ICE candidates
                if (this.pendingCandidates.length > 0) {
                    this.processPendingCandidates();
                }
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                this.isConnected = false;
                this.channelReady = false;
                this.dataChannel = null;
            }
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
            if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
                this.dataChannel = event.channel;
                this.setupDataChannelHandlers(this.dataChannel);
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

        // Handle ICE candidate events
        this.localPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('New ICE candidate');
                this.socket.emit('ice-candidate', {
                    userId: this.userId,
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        this.localPeerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.localPeerConnection.connectionState);
            if (this.localPeerConnection.connectionState === 'connected') {
                this.isConnected = true;
            } else if (this.localPeerConnection.connectionState === 'failed' ||
                      this.localPeerConnection.connectionState === 'closed') {
                this.isConnected = false;
                this.channelReady = false;
            }
        };

        // Handle ICE connection state
        this.localPeerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.localPeerConnection.iceConnectionState);
        };

        // Handle signaling state
        this.localPeerConnection.onsignalingstatechange = () => {
            console.log('Signaling state:', this.localPeerConnection.signalingState);
        };

        // Setup handlers for data channel creation and connection state changes
        this.localPeerConnection.ondatachannel = (event) => {
            console.log('Remote data channel received');
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers(this.dataChannel);
        };

        // Create data channel only if we're the initiator
        if (this.isInitiator) {
            const dataChannelConfig = {
                ordered: true,
                protocol: 'json'
            };

            try {
                this.dataChannel = this.localPeerConnection.createDataChannel('messageChannel', dataChannelConfig);
                console.log('Created data channel:', this.dataChannel.label);
                this.setupDataChannelHandlers(this.dataChannel);
            } catch (e) {
                console.error('Error creating data channel:', e);
            }
        }
    },

    waitForDataChannel: async function() {
        return new Promise((resolve, reject) => {
            // If channel is already open, resolve immediately
            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                console.log('Data channel already open');
                resolve(true);
                return;
            }

            // Set up one-time event listener for channel open
            const onOpen = () => {
                console.log('Data channel opened');
                cleanup();
                resolve(true);
            };

            // Set up one-time event listener for channel error
            const onError = (error) => {
                console.error('Data channel error:', error);
                cleanup();
                reject(error);
            };

            // Set up one-time event listener for connection failure
            const onFailed = () => {
                console.error('Connection failed while waiting for data channel');
                cleanup();
                reject(new Error('Connection failed'));
            };

            // Function to remove all event listeners
            const cleanup = () => {
                if (this.dataChannel) {
                    this.dataChannel.removeEventListener('open', onOpen);
                    this.dataChannel.removeEventListener('error', onError);
                }
                if (this.localPeerConnection) {
                    this.localPeerConnection.removeEventListener('connectionstatechange', onConnectionChange);
                }
                clearTimeout(timeoutId);
            };

            // Handle connection state changes
            const onConnectionChange = () => {
                const state = this.localPeerConnection.connectionState;
                if (state === 'failed' || state === 'closed') {
                    onFailed();
                }
            };

            // Add event listeners
            if (this.dataChannel) {
                this.dataChannel.addEventListener('open', onOpen);
                this.dataChannel.addEventListener('error', onError);
            }
            if (this.localPeerConnection) {
                this.localPeerConnection.addEventListener('connectionstatechange', onConnectionChange);
            }

            // Set timeout
            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout waiting for data channel'));
            }, 10000); // 10 second timeout
        });
    },

    setupDataChannelHandlers: function(channel) {
        channel.onopen = () => {
            console.log('Data channel opened:', channel.label);
            this.channelReady = true;
            
            if (typeof this.onchannelopen === 'function') {
                this.onchannelopen();
            }

            // Send immediate ping to verify the channel
            if (this.isInitiator) {
                try {
                    channel.send(JSON.stringify({
                        type: 'ping',
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.error('Error sending initial ping:', e);
                }
            }
        };

        channel.onclose = () => {
            console.log('Data channel closed:', channel.label);
            this.channelReady = false;
            if (this.dataChannel === channel) {
                this.dataChannel = null;
            }
            
            if (typeof this.onchannelclose === 'function') {
                this.onchannelclose();
            }
        };

        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received message on channel:', channel.label, data);
                
                // Handle ping/pong for channel verification
                if (data.type === 'ping') {
                    channel.send(JSON.stringify({
                        type: 'pong',
                        timestamp: data.timestamp
                    }));
                    return;
                }
                
                if (data.type === 'pong') {
                    const latency = Date.now() - data.timestamp;
                    console.log('Channel verified with latency:', latency, 'ms');
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
            this.channelReady = false;
            if (this.dataChannel === channel) {
                this.dataChannel = null;
            }
        };
    },

    sendVerification: function() {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const verifyMsg = {
                type: 'verify-channel',
                role: this.isInitiator ? 'initiator' : 'receiver',
                timestamp: Date.now()
            };
            this.dataChannel.send(JSON.stringify(verifyMsg));
        }
    },

    handleVerification: function(data) {
        console.log('Channel verification:', data);
        if (!this.isInitiator && data.role === 'initiator') {
            this.sendVerification();
        }
    },

    // create peer connection offer, used by peer initializing the communication
    createOffer: async function() {
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
    },

    // accept incoming offer from remote peer, used by peer receiving the connection
    acceptOffer: async function(sdp) {
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
    },

    // after receiving peer accepted the offer, they get the answer SDP
    // this is used by initializing peer to accept the answer, after which
    // the peer to peer connection is ready
    acceptAnswer: async function(sdp) {
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
    },

    // send a message to connected peers
    send: function(message) {
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
    },

    isDataChannelOpen: function() {
        return this.dataChannel && this.dataChannel.readyState === 'open';
    },

    processPendingCandidates: async function() {
        if (!this.localPeerConnection.remoteDescription) {
            console.log('Remote description not set, keeping candidates pending');
            return;
        }

        while (this.pendingCandidates.length > 0) {
            const candidate = this.pendingCandidates.shift();
            try {
                await this.localPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('Added pending ICE candidate');
            } catch (e) {
                console.warn('Error adding pending ICE candidate:', e);
                this.pendingCandidates.unshift(candidate);
                break;
            }
        }
    }
}

// Export the P2P object
window.P2P = P2P;