document.addEventListener('DOMContentLoaded', () => {

    const output = document.getElementById('output');
    const inputBox = document.getElementById('inputBox');
    const submitButton = document.getElementById('submitButton');
    const terminal = document.getElementById('terminal');

    // Shared data store
    let sharedDocument = "Welcome to EclipNet. Type 'help' for a list of commands.";
    // Display initial document
    output.textContent = "Welcome to EclipNet v1.0\n!(C) 2025 ALL RIGHTS RELEASED\nReady.";

    // Helper function to scroll app's internal elements
    function scrollToBottom() {
        output.scrollTop = output.scrollHeight;
        inputBox.scrollIntoView({
            block: 'nearest'
        });
    }

    // Function to append text to the output
    function appendOutput(text) {
        output.textContent += `\n${text}`;
        scrollToBottom();
    }

    // Function to process the typed command
    function processCommand() {
        const command = inputBox.value;
        appendOutput(`> ${command}`);

        // Command parsing
        const parts = command.trim().split(' ');
        const cmd = parts[0].toLowerCase();

        switch (cmd) {
            case 'cat':
                appendOutput(sharedDocument);
                break;
            case 'push':
                if (p2p.sendMessage({ type: 'doc-push', content: sharedDocument })) {
                    appendOutput('Document pushed to peer.');
                } else {
                    appendOutput('Error: Could not push. No peer connected?');
                }
                break;
            case 'pull':
                if (p2p.sendMessage({ type: 'doc-pull-request' })) {
                    appendOutput('Pull request sent to peer.');
                } else {
                    appendOutput('Error: Could not pull. No peer connected?');
                }
                break;
            case 'help':
                appendOutput('Available commands:\n  /help          - Show this help message\n  /cat           - Display the shared document\n  /push          - Send your document version to the peer\n  /pull          - Request document from the peer\n\nAny other text is sent as a chat message.');
                break;
            default:
                // If it's not a known command, treat it as a chat message.
                if (p2p.sendMessage({ type: 'chat', content: command })) {
                    // We don't need to show "Sent: ..." because the input is already echoed.
                } else {
                    appendOutput('Error: Could not send message. No peer connected?');
                }
                break;
        }

        inputBox.value = '';
    }

    // --- UPDATED: Viewport Resize Handler ---
    function handleViewportResize() {
        // Set the terminal height to the exact visible height
        terminal.style.height = `${window.visualViewport.height}px`;

        // --- THIS IS THE FIX ---
        // Force the window's layout scroll position back to (0, 0)
        window.scrollTo(0, 0);
        // ---------------------

        // Scroll our internal elements to the bottom
        scrollToBottom();
    }
    // ------------------------------------------

    // --- Event Listeners ---
    submitButton.addEventListener('click', processCommand);

    inputBox.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            processCommand();
        }
    });

    // Focus input when terminal is clicked
    terminal.addEventListener('click', () => {
        inputBox.focus();
    });

    // Scroll to bottom when input is focused
    inputBox.addEventListener('focus', () => {
        scrollToBottom();
    });

    // Add the main viewport listener
    window.visualViewport.addEventListener('resize', handleViewportResize);

    // Set the initial size on page load
    handleViewportResize();

    // Listen for document updates from P2P layer
    output.addEventListener('doc-update', (e) => {
        sharedDocument = e.detail;
        appendOutput('\n--- Document updated by peer ---');
        appendOutput(sharedDocument);
        appendOutput('------------------------------');
    });
    output.addEventListener('chat-message', (e) => {
        const message = e.detail;
        appendOutput(`\nReceived: ${message}`);
    });

    // Listen for a peer's request to pull our document
    output.addEventListener('doc-push-request', () => {
        if (p2p.sendMessage({ type: 'doc-push', content: sharedDocument })) {
            appendOutput('Peer requested document. Pushing current version.');
        }
    });
});