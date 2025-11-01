document.addEventListener('DOMContentLoaded', () => {

    const output = document.getElementById('output');
    const inputBox = document.getElementById('inputBox');
    const submitButton = document.getElementById('submitButton');
    const terminal = document.getElementById('terminal');

    // --- NEW: Shared data store ---
    let sharedDocument = "Welcome to EclipNet. This is a shared document.";
    // --- NEW: Display initial document ---
    output.textContent = sharedDocument;


    // Helper function to scroll app's internal elements
    function scrollToBottom() {
        output.scrollTop = output.scrollHeight;
        inputBox.scrollIntoView({
            block: 'nearest'
        });
    }

    // --- NEW: Function to append text to the output ---
    function appendOutput(text) {
        output.textContent += `\n${text}`;
        scrollToBottom();
    }

    // Function to process the typed command
    function processCommand() {
        const command = inputBox.value;
        appendOutput(`> ${command}`);

        // --- NEW: Command parsing ---
        const parts = command.trim().split(' ');
        const cmd = parts[0].toLowerCase();

        switch (cmd) { // Note: 'send' command is for the simpler p2p2.js logic
            case 'help':
                appendOutput('Available commands:\n  cat - Display the document\n  push - Send your document version to the peer\n  pull - Request the document from the peer');
                break;
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
            case 'send': // For p2p2.js direct sending
                p2p.sendMessage(parts.slice(1).join(' '));
                break;
            default:
                appendOutput(`Command not found: ${cmd}`);
                break;
        }
        // --- END: Command parsing ---

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

    // --- NEW: Listen for document updates from P2P layer ---
    output.addEventListener('doc-update', (e) => {
        sharedDocument = e.detail;
        appendOutput('\n--- Document updated by peer ---');
        appendOutput(sharedDocument);
        appendOutput('------------------------------');
    });

    output.addEventListener('doc-push-request', () => {
        if (p2p.sendMessage({ type: 'doc-push', content: sharedDocument })) {
            appendOutput('Peer requested document. Pushing current version.');
        }
    });
    // --- END: P2P Listeners ---
});