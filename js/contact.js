
// THE EMAIL IS STILL MOCK, IT PLEASE RECHECK BEFORE PUBLISHING

document.addEventListener("DOMContentLoaded", () => {
    
    // BACKEND CONFIGURATION MOCK
    // Edit these email mappings to match your student council's actual internal emails.
    const RAContact_emailMap = {
        exec: "rama.med@gmail.com",
        IA: "rama.med@gmail.com",
        WB: "rama.med@gmail.com",
        AA: "rama.med@gmail.com",
        EA: "rama.med@gmail.com",
        CC: "rama.med@gmail.com",
        OD: "rama.med@gmail.com",
    }

    const form = document.getElementById("RAContact_portal_form");
    const statusBox = document.getElementById("RAContact_status_msg");

    form.addEventListener("submit", function(event) {
        event.preventDefault(); // Terminate standard non-AJAX page reload refresh

        // Extract UI form data values
        const recipientKey = document.getElementById("RAContact_recipient").value;
        const purposeValue = document.getElementById("RAContact_purpose").value;
        const senderName = document.getElementById("RAContact_name").value.trim();
        const messageBody = document.getElementById("RAContact_message").value.trim();

        // Target target internal email mapped from select state 
        const targetEmail = RAContact_emailMap[recipientKey] || "ramsc.central@mahidol.ac.th";

        // Reset display container message state
        statusBox.className = "RAContact_status_box";
        statusBox.style.display = "none";

        // Simple validation check block
        if (!recipientKey || !purposeValue || !senderName || !messageBody) {
            statusBox.innerText = "Error: Please verify all required form selection parameters fields are full.";
            statusBox.classList.add("RAContact_status_error");
            return;
        }

        // --- FRONTEND MOCK BACKEND EXECUTION LOGIC ---
        // Replacing this block with real database triggers/API integrations later.
        console.log("--- RAMSC Form Route Dispatch Simulation ---");
        console.log(`Routing Data To: ${targetEmail}`);
        console.log(`Purpose Tagged: ${purposeValue}`);
        console.log(`Sender Handle: ${senderName === '-' ? 'ANONYMOUS STUDENT' : senderName}`);
        console.log(`Payload Contents: "${messageBody}"`);

        // Simulate an asynchronous API delay network trip (e.g., fetch, axios, formspree)
        statusBox.innerText = "Processing submission secure stream pipeline...";
        statusBox.classList.add("RAContact_status_success");
        statusBox.style.display = "block";

        setTimeout(() => {
            // Success response representation UI display update
            if (senderName === '-') {
                statusBox.innerHTML = `<strong>Submission Sent Anonymously!</strong> Your message has been safely encrypted and dispatched directly to the <u>${document.getElementById("RAContact_recipient").options[document.getElementById("RAContact_recipient").selectedIndex].text}</u> queue.`;
            } else {
                statusBox.innerHTML = `<strong>Message Dispatched Successfully!</strong> Thank you ${senderName}. Your query regarding "${purposeValue}" was routed directly to <u>${targetEmail}</u>.`;
            }
            
            // Clear standard interface layout text parameters
            form.reset();
        }, 1200);
    });
});