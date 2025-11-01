// Simple P2P Communication using WebRTC
class P2P2 {
    constructor() {
        this.signalingServerURL = 'wss://signal.filonexus.com';
        this.peerConnection = null;
        this.dataChannel = null;
        this.socket = new io(this.signalingServerURL);
        this.userId = Math.round(Math.random() * 1000000);
        this.setupSignaling();
    }

    setupSignaling() {
        // Handle incoming offers
        this.socket.on('receive-offer', async (data) => {
            if (data.userId !== this.userId) {
                await this.handleOffer(data.offer.sdp);
                this.log('Received connection offer. Establishing connection...');
            }
        });

        // Handle incoming answers
        this.socket.on('receive-answer', async (data) => {
            if (data.userId !== this.userId) {
                await this.handleAnswer(data.answer.sdp);
                this.log('Connection established!');
            }
        });

        // Handle ICE candidates
        this.socket.on('receive-ice-candidate', async (data) => {
            if (data.userId !== this.userId && this.peerConnection) {
                await this.peerConnection.addIceCandidate(data.candidate);
            }
        });
    }

    initializePeerConnection() {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(config);

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('send-ice-candidate', {
                    userId: this.userId,
                    candidate: event.candidate
                });
            }
        };

        // Handle incoming data channels
        this.peerConnection.ondatachannel = (event) => {
            this.log('Remote data channel received');
            this.dataChannel = event.channel;
            // The initiator already created a channel, so only the receiver needs this.
            this.setupDataChannel();
        };

        // Create data channel for initiator
        this.dataChannel = this.peerConnection.createDataChannel('messageChannel');
        this.setupDataChannel();

        this.log('Peer connection initialized. Waiting for connection...');
    }

    setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onmessage = (event) => {
            // Handle different message types
            try {
                const msg = JSON.parse(event.data);
                this.log(`Received: ${msg.type}`);

                // Find the shared document and output function from the main script
                const output = document.getElementById('output');

                if (msg.type === 'doc-push') {
                    output.dispatchEvent(new CustomEvent('doc-update', { detail: msg.content }));
                } else if (msg.type === 'doc-pull-request') {
                    output.dispatchEvent(new CustomEvent('doc-push-request'));
                } else if (msg.type === 'chat') {
                    output.dispatchEvent(new CustomEvent('chat-message', { detail: msg.content }));
                } else {
                    // Fallback for simple string messages
                    output.dispatchEvent(new CustomEvent('chat-message', { detail: event.data }));
                }

            } catch (e) {
                // Fallback for non-JSON messages
                this.log(`Received raw data: ${event.data}`);
            }
        };

        this.dataChannel.onopen = () => {
            if (!this.channelReady) { // Prevent double-logging
                this.log('Data channel opened - ready to communicate!');
                const p2pButton = document.getElementById('p2p-init');
                if (p2pButton) {
                    p2pButton.textContent = '1 Peer Connected';
                    p2pButton.classList.add('connected');
                }
            }
            this.log('Data channel opened - ready to communicate!');
            this.channelReady = true;
        };

        this.dataChannel.onclose = () => {
            this.log('Data channel closed.');
            const p2pButton = document.getElementById('p2p-init');
            if (p2pButton) {
                p2pButton.textContent = 'Init peer connection';
                p2pButton.classList.remove('connected');
            }
            this.channelReady = false;
        };
    }

    async initiateConnection() {
        if (!this.peerConnection) {
            this.initializePeerConnection();
        }

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.socket.emit('send-offer', {
                userId: this.userId,
                offer
            });

            this.log('Connection offer sent. Waiting for peer...');
        } catch (error) {
            this.log(`Error creating offer: ${error.message}`);
        }
    }

    async handleOffer(sdp) {
        if (!this.peerConnection) {
            this.initializePeerConnection();
        }

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('send-answer', {
                userId: this.userId,
                answer
            });
        } catch (error) {
            this.log(`Error handling offer: ${error.message}`);
        }
    }

    async handleAnswer(sdp) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
        } catch (error) {
            this.log(`Error handling answer: ${error.message}`);
        }
    }

    sendMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            // Always send JSON strings for objects
            const data = typeof message === 'string' ? message : JSON.stringify(message);
            this.dataChannel.send(data);
            if (typeof message === 'object') {
                this.log(`Sent: ${message.type}`);
            }
            return true;
        }
        this.log('Cannot send message - no open connection');
        return false;
    }

    log(message) {
        const output = document.getElementById('output');
        if (output) {
            output.textContent += `\n[P2P] ${message}`;
            output.scrollTop = output.scrollHeight;
        }
    }
}

// Initialize P2P when the page loads
let p2p;
document.addEventListener('DOMContentLoaded', () => {
    p2p = new P2P2();
    
    // Connect init button
    const initButton = document.getElementById('p2p-init');
    if (initButton) {
        initButton.addEventListener('click', () => {
            p2p.initiateConnection();
        });
    }

    // Handle terminal commands for P2P
    const inputBox = document.getElementById('inputBox');
    const submitButton = document.getElementById('submitButton');

    function handleCommand(command) {
        if (command.startsWith('/send ')) {
            // This is now handled by the main command processor in EclipNet.js
            // const message = command.slice(6);
            // p2p.sendMessage(message);
        }
    }

    if (submitButton && inputBox) {
        // Command handling is now done in EclipNet.js
    }

});