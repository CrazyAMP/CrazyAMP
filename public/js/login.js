const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const continueButton = document.getElementById("continueButton");
const message = document.getElementById("message");

let currentRobloxUser = null;

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = usernameInput.value.trim();

    if (!username) {
        showMessage("Please enter your Roblox username.", false);
        return;
    }

    continueButton.disabled = true;
    continueButton.textContent = "Looking up...";
    message.textContent = "";

    try {
        const response = await fetch("/api/roblox/lookup", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username
            })
        });

        const data = await response.json();

        if (!data.success) {
            showMessage(
                data.message || "Roblox user not found.",
                false
            );

            return;
        }

        currentRobloxUser = data.user;

        showVerificationPopup(
            data.user,
            data.verificationCode
        );

    } catch (error) {
        console.error(error);

        showMessage(
            "Something went wrong. Please try again.",
            false
        );

    } finally {
        continueButton.disabled = false;
        continueButton.textContent = "Continue";
    }
});


function showVerificationPopup(user, verificationCode) {

    const existingPopup =
        document.getElementById("verificationOverlay");

    if (existingPopup) {
        existingPopup.remove();
    }

    const overlay = document.createElement("div");

    overlay.id = "verificationOverlay";

    overlay.innerHTML = `
        <div class="verification-overlay">

            <div class="verification-card">

                <button
                    class="close-verification"
                    id="closeVerification"
                    type="button"
                >
                    ×
                </button>

                <div class="verification-header">

                    <div class="verification-icon">
                        ✓
                    </div>

                    <h2>Verify your Roblox account</h2>

                    <p>
                        We found your Roblox account.
                        Complete the verification below to continue.
                    </p>

                </div>


                <div class="roblox-user">

                    <img
                        src="${user.avatar || ""}"
                        alt="Roblox Avatar"
                        class="roblox-avatar"
                    >

                    <div class="roblox-user-info">

                        <span class="roblox-display-name">
                            ${escapeHtml(user.displayName)}
                        </span>

                        <span class="roblox-username">
                            @${escapeHtml(user.username)}
                        </span>

                    </div>

                </div>


                <div class="verification-step">

                    <div class="step-number">
                        1
                    </div>

                    <div class="step-content">

                        <h3>Copy your verification code</h3>

                        <p>
                            Put this exact code into your Roblox
                            profile's About section.
                        </p>

                        <div class="code-box">

                            <span id="verificationCode">
                                ${verificationCode}
                            </span>

                            <button
                                type="button"
                                id="copyCodeButton"
                            >
                                Copy
                            </button>

                        </div>

                    </div>

                </div>


                <div class="verification-step">

                    <div class="step-number">
                        2
                    </div>

                    <div class="step-content">

                        <h3>Open your Roblox profile</h3>

                        <p>
                            Add the code to your About section,
                            then save your Roblox profile.
                        </p>

                        <button
                            type="button"
                            class="profile-button"
                            id="openProfileButton"
                        >
                            Open Roblox Profile
                            <span>↗</span>
                        </button>

                    </div>

                </div>


                <div class="verification-step">

                    <div class="step-number">
                        3
                    </div>

                    <div class="step-content">

                        <h3>Verify your account</h3>

                        <p>
                            Once you've added the code,
                            click verify.
                        </p>

                        <button
                            type="button"
                            class="verify-button"
                            id="verifyButton"
                        >
                            Verify Account
                        </button>

                    </div>

                </div>


                <div
                    id="verificationMessage"
                    class="verification-message"
                ></div>

                <div class="verification-note">
                    🔒 We only use your Roblox profile to verify
                    ownership of the account.
                </div>

            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    document
        .getElementById("closeVerification")
        .addEventListener("click", closeVerificationPopup);

    document
        .getElementById("copyCodeButton")
        .addEventListener("click", () => {
            copyVerificationCode(verificationCode);
        });

    document
        .getElementById("openProfileButton")
        .addEventListener("click", () => {
            window.open(
                `https://www.roblox.com/users/${user.id}/profile`,
                "_blank"
            );
        });

    document
        .getElementById("verifyButton")
        .addEventListener("click", verifyRobloxAccount);
}


function closeVerificationPopup() {

    const overlay =
        document.getElementById("verificationOverlay");

    if (overlay) {
        overlay.remove();
    }
}


async function copyVerificationCode(code) {

    try {
        await navigator.clipboard.writeText(code);

        const button =
            document.getElementById("copyCodeButton");

        button.textContent = "Copied!";

        setTimeout(() => {
            button.textContent = "Copy";
        }, 1500);

    } catch (error) {
        console.error("Failed to copy code:", error);
    }
}


async function verifyRobloxAccount() {

    if (!currentRobloxUser) {
        return;
    }


    const verifyButton =
        document.getElementById("verifyButton");

    const verificationMessage =
        document.getElementById(
            "verificationMessage"
        );


    verifyButton.disabled = true;

    verifyButton.textContent =
        "Checking...";


    verificationMessage.textContent = "";

    verificationMessage.className =
        "verification-message";


    try {

        const response = await fetch(
            "/api/roblox/verify",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    robloxId:
                        currentRobloxUser.id
                })
            }
        );


        const data =
            await response.json();


        if (!data.success) {

            verificationMessage.textContent =
                data.message ||
                "Verification failed.";

            verificationMessage.classList.add(
                "error"
            );

            return;
        }


        verificationMessage.textContent =
            "Account verified! Redirecting...";


        verificationMessage.classList.add(
            "success"
        );


        // Give the user a moment to see
        // the success message.
        setTimeout(() => {

            window.location.href = "/";

        }, 800);


    } catch (error) {

        console.error(error);


        verificationMessage.textContent =
            "Something went wrong while verifying.";


        verificationMessage.classList.add(
            "error"
        );


    } finally {

        verifyButton.disabled = false;

        verifyButton.textContent =
            "Verify Account";

    }

}


function showMessage(text, success) {

    message.textContent = text;

    message.style.color = success
        ? "#a855f7"
        : "#f87171";
}


function escapeHtml(value) {

    const div = document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}