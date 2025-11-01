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
            this.dataChannel = event.channel;
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
            this.log(`Received: ${event.data}`);
        };

        this.dataChannel.onopen = () => {
            this.log('Data channel opened - ready to communicate!');
        };

        this.dataChannel.onclose = () => {
            this.log('Data channel closed.');
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
            this.dataChannel.send(message);
            this.log(`Sent: ${message}`);
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
            const message = command.slice(6);
            p2p.sendMessage(message);
        }
    }

    if (submitButton && inputBox) {
        submitButton.addEventListener('click', () => {
            handleCommand(inputBox.value);
        });

        inputBox.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                handleCommand(inputBox.value);
            }
        });
    }
});