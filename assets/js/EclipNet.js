document.addEventListener('DOMContentLoaded', () => {

    const output = document.getElementById('output');
    const inputBox = document.getElementById('inputBox');
    const submitButton = document.getElementById('submitButton');
    const terminal = document.getElementById('terminal');

    // Helper function to scroll app's internal elements
    function scrollToBottom() {
        output.scrollTop = output.scrollHeight;
        inputBox.scrollIntoView({
            block: 'nearest'
        });
    }

    // Function to process the typed command
    function processCommand() {
        const command = inputBox.value;
        output.textContent += `\n> ${command}`;
        output.textContent += `\n${command}`;
        output.textContent += `\n`;
        inputBox.value = '';
        scrollToBottom();
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
});