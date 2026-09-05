
    /*
     * =========================
     * ELEMENTS
     * =========================
     */

    const canvas =
        document.getElementById("gameCanvas");

    const ctx =
        canvas.getContext("2d");

    const connectBtn =
        document.getElementById("connect-btn");

    const serverUrlInput =
        document.getElementById("server-url");

    const statusText =
        document.getElementById("status");

    const healthText =
        document.getElementById("health");

    const ammoText =
        document.getElementById("ammo");

    const roundText =
        document.getElementById("round");

    const reloadText =
        document.getElementById("reload");


    const usernameInput =
    document.getElementById("usernameInput");

const createRoomButton =
    document.getElementById("createRoomButton");

const joinRoomButton =
    document.getElementById("joinRoomButton");

const roomInput =
    document.getElementById("roomInput");

const roomDisplay =
    document.getElementById("roomDisplay");

const roomError =
    document.getElementById("roomError");

    const roomMenu = document.getElementById("roomMenu");
const gameRoomCode = document.getElementById("gameRoomCode");

    /*
     * =========================
     * GAME VARIABLES
     * =========================
     */

    let socket = null;

    let players = {};
    let bullets = {};

    let myPlayerId = null;

    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    let myAngle = 0;

    const speed = 8;
    
    let shooting = false;

    createRoomButton.addEventListener(
    "click",
    () => {

        if (!socket || !socket.connected) {
            return;
        }

        const username =
            usernameInput.value.trim();

        if (!username) {
            roomError.innerText =
                "Enter a username first.";

            return;
        }

        socket.emit(
            "createRoom",
            username
        );

    }
);


joinRoomButton.addEventListener(
    "click",
    () => {

        if (!socket || !socket.connected) {
            return;
        }

        const username =
            usernameInput.value.trim();

        const roomCode =
            roomInput.value.trim();

        if (!username) {

            roomError.innerText =
                "Enter a username first.";

            return;

        }

        if (!roomCode) {

            roomError.innerText =
                "Enter a room code.";

            return;

        }


        socket.emit(
            "joinRoom",
            {
                username: username,
                roomCode: roomCode
            }
        );

    }
);



    /*
     * =========================
     * CONNECTION
     * =========================
     */

    function connectToServer() {

        if (typeof io === "undefined") {

            console.error(
                "Socket.io failed to load."
            );

            statusText.innerText =
                "ERROR: Socket.io library failed to load.";

            statusText.style.color =
                "red";

            return;
        }


        if (socket) {
            socket.disconnect();
        }


        const url =
            serverUrlInput.value.trim();


        console.log(
            "Connecting to:",
            url
        );


        statusText.innerText =
            "Connecting...";

        statusText.style.color =
            "yellow";


        connectBtn.innerText =
            "Connecting...";

        connectBtn.style.backgroundColor =
            "#b8860b";


        socket = io(url);


        /*
         * CONNECTED
         */

        socket.on("connect", () => {

            console.log(
                "Connected!",
                socket.id
            );

            myPlayerId =
                socket.id;


            connectBtn.innerText =
                "Connected!";

            connectBtn.style.backgroundColor =
                "green";


            statusText.innerText =
                "Connected as " + socket.id;

            statusText.style.color =
                "lightgreen";
        });


        /*
         * DISCONNECTED
         */

        socket.on("disconnect", (reason) => {

            console.log(
                "Disconnected:",
                reason
            );


            myPlayerId = null;


            connectBtn.innerText =
                "Connect to Server";

            connectBtn.style.backgroundColor =
                "#007bff";


            statusText.innerText =
                "Disconnected: " + reason;

            statusText.style.color =
                "orange";
        });


        /*
         * CONNECTION ERROR
         */

        socket.on(
            "connect_error",
            (error) => {

                console.error(
                    "Connection error:",
                    error
                );


                connectBtn.innerText =
                    "Connection Failed";

                connectBtn.style.backgroundColor =
                    "red";


                statusText.innerText =
                    "Connection error: " +
                    error.message;

                statusText.style.color =
                    "red";
            }
        );

// =========================
// ROOM JOINED
// =========================

socket.on("roomJoined", (data) => {
    roomDisplay.innerText =
        "Room: " + data.roomCode;

    roomError.innerText = "";

    // Hide the lobby
    roomMenu.style.display = "none";

    console.log(
        "Joined room:",
        data.roomCode
    );
});


// =========================
// ROOM ERROR
// =========================

socket.on("roomError", (message) => {

    roomError.innerText =
        message;

});


        /*
         * PLAYER / GAME STATE
         */

        socket.on(
            "updatePlayers",
            (newPlayers) => {

                players =
                    newPlayers;

                drawGame();
                updateHUD();
            }
        );

        socket.on("updateBullets", (newBullets) => {
            bullets = newBullets;
            drawGame();
        });

    }


    /*
     * =========================
     * MOUSE AIMING
     * =========================
     */

    canvas.addEventListener(
        "mousemove",
        (e) => {

            const rect =
                canvas.getBoundingClientRect();


            mouseX =
                e.clientX - rect.left;

            mouseY =
                e.clientY - rect.top;


            updateAim();
        }
    );


    function updateAim() {

    if (
        !myPlayerId ||
        !players[myPlayerId]
    ) {
        return;
    }

    const player =
        players[myPlayerId];

    myAngle =
        Math.atan2(
            mouseY - player.y,
            mouseX - player.x
        );

    /*
     * Update our local player immediately
     * so aiming feels instant.
     */

    player.angle = myAngle;

    /*
     * Tell the server too.
     */

    if (
        socket &&
        socket.connected
    ) {
        socket.emit(
            "aim",
            {
                angle: myAngle
            }
        );
    }

    drawGame();
}

    /*
     * =========================
     * SHOOTING
     * =========================
     */

    canvas.addEventListener(
        "mousedown",
        (e) => {

            if (e.button !== 0) {
                return;
            }


            shooting = true;


            shoot();
        }
    );


    window.addEventListener(
        "mouseup",
        (e) => {

            if (e.button === 0) {
                shooting = false;
            }
        }
    );


    function shoot() {

        if (
            !socket ||
            !socket.connected
        ) {
            return;
        }


        socket.emit("shoot");
    }


    /*
     * =========================
     * RELOADING
     * =========================
     */

    window.addEventListener(
        "keydown",
        (e) => {

            if (
                e.key.toLowerCase() === "r"
            ) {

                if (
                    socket &&
                    socket.connected
                ) {

                    socket.emit(
                        "reload"
                    );
                }

                return;
            }

        }
    );


    /*
     * =========================
     * MOVEMENT
     * =========================
     */

    const keys = {};


    window.addEventListener(
        "keydown",
        (e) => {

            if (
             e.target.tagName === "INPUT" ||
            e.target.tagName === "TEXTAREA"
            ) {
            return;
            }   

            const key =
                e.key.toLowerCase();


            if (
                [
                    "w",
                    "a",
                    "s",
                    "d",
                    "arrowup",
                    "arrowdown",
                    "arrowleft",
                    "arrowright"
                ].includes(key)
            ) {

                e.preventDefault();

                keys[key] = true;
            }
        }
    );


    window.addEventListener(
        "keyup",
        (e) => {

            keys[
                e.key.toLowerCase()
            ] = false;
        }
    );


    /*
     * Send movement continuously.
     *
     * This will make the controls much
     * smoother than the old keydown-only
     * system.
     */

    function movementLoop() {

    if (
        socket &&
        socket.connected &&
        myPlayerId &&
        players[myPlayerId]
    ) {

        let forward = 0;
        let strafe = 0;


        /*
         * FORWARD / BACKWARD
         */

        if (
            keys["w"] ||
            keys["arrowup"]
        ) {
            forward += 1;
        }

        if (
            keys["s"] ||
            keys["arrowdown"]
        ) {
            forward -= 1;
        }


        /*
         * LEFT / RIGHT STRAFE
         */

        if (
            keys["a"] ||
            keys["arrowleft"]
        ) {
            strafe -= 1;
        }

        if (
            keys["d"] ||
            keys["arrowright"]
        ) {
            strafe += 1;
        }


        /*
         * Convert forward/strafe movement
         * into X/Y using the player's angle.
         */

        if (
            forward !== 0 ||
            strafe !== 0
        ) {

            const angle = myAngle;


            let x =
                Math.cos(angle) * forward
                +
                Math.cos(angle + Math.PI / 2) * strafe;


            let y =
                Math.sin(angle) * forward
                +
                Math.sin(angle + Math.PI / 2) * strafe;


            /*
             * Normalize diagonal movement.
             */

            const length =
                Math.sqrt(
                    x * x + y * y
                );


            if (length > 0) {

                x /= length;
                y /= length;

            }


            socket.emit(
                "move",
                {
                    x: x * speed,
                    y: y * speed
                }
            );
        }
    }


    requestAnimationFrame(
        movementLoop
    );
}

    movementLoop();


    /*
     * =========================
     * DRAW GAME
     * =========================
     */

    function drawGame() {

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        /*
         * Draw background grid.
         */

        ctx.strokeStyle =
            "#292929";

        ctx.lineWidth = 1;


        for (
            let x = 0;
            x <= canvas.width;
            x += 40
        ) {

            ctx.beginPath();

            ctx.moveTo(
                x,
                0
            );

            ctx.lineTo(
                x,
                canvas.height
            );

            ctx.stroke();
        }


        for (
            let y = 0;
            y <= canvas.height;
            y += 40
        ) {

            ctx.beginPath();

            ctx.moveTo(
                0,
                y
            );

            ctx.lineTo(
                canvas.width,
                y
            );

            ctx.stroke();
        }


        /*
         * Draw players.
         */

        for (let id in players) {

    const player = players[id];

    if (!player) {
        continue;
    }

    // =========================
    // DEAD / RELOADING ALPHA
    // =========================

    if (player.dead) {
        ctx.globalAlpha = 0.25;
    } else if (player.reloading) {
        ctx.globalAlpha = 0.5;
    } else {
        ctx.globalAlpha = 1;
    }


    // =========================
    // PLAYER BODY
    // =========================

    ctx.fillStyle =
        player.color || "green";

    ctx.beginPath();

    ctx.arc(
        player.x,
        player.y,
        20,
        0,
        Math.PI * 2
    );

    ctx.fill();


    // =========================
    // AIM / GUN
    // =========================

    const angle =
        player.angle || 0;

    const gunLength = 28;

    ctx.strokeStyle = "white";
    ctx.lineWidth = 6;

    ctx.beginPath();

    ctx.moveTo(
        player.x,
        player.y
    );

    ctx.lineTo(
        player.x +
            Math.cos(angle) * gunLength,

        player.y +
            Math.sin(angle) * gunLength
    );

    ctx.stroke();


    // =========================
    // PLAYER OUTLINE
    // =========================

    ctx.strokeStyle =
        id === myPlayerId
            ? "white"
            : "#777";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
        player.x,
        player.y,
        20,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    // =========================
    // DEAD PLAYER X
    // =========================

    if (player.dead) {

        ctx.strokeStyle = "red";
        ctx.lineWidth = 4;

        ctx.beginPath();

        ctx.moveTo(
            player.x - 12,
            player.y - 12
        );

        ctx.lineTo(
            player.x + 12,
            player.y + 12
        );

        ctx.moveTo(
            player.x + 12,
            player.y - 12
        );

        ctx.lineTo(
            player.x - 12,
            player.y + 12
        );

        ctx.stroke();
    }

        // Username

ctx.globalAlpha = 1;

ctx.fillStyle = "white";

ctx.font = "bold 14px Arial";

ctx.textAlign = "center";

ctx.textBaseline = "bottom";

ctx.fillText(
    player.username,
    player.x,
    player.y - 25
);


    // =========================
    // RESET ALPHA
    // =========================

    ctx.globalAlpha = 1;
   
}

// =========================
// DRAW BULLETS
// =========================

for (const id in bullets) {

    const bullet = bullets[id];

    if (!bullet) {
        continue;
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = "white";

    ctx.beginPath();

    ctx.arc(
        bullet.x,
        bullet.y,
        5,
        0,
        Math.PI * 2
    );

    ctx.fill();
}

}


    /*
     * =========================
     * HUD
     * =========================
     */

    function updateHUD() {

        if (
            !myPlayerId ||
            !players[myPlayerId]
        ) {
            return;
        }


        const player =
            players[myPlayerId];


        const health =
            player.health ?? 100;

        const ammo =
            player.ammo ?? 6;


        healthText.innerText =
            "❤️ " + health + " HP";


        ammoText.innerText =
            "🔫 " +
            ammo +
            " / 6";


        roundText.innerText =
            "ROUND " +
            (player.round ?? 1) +
            " / 5";


        if (player.reloading) {

            reloadText.style.display =
                "block";

        } else {

            reloadText.style.display =
                "none";
        }

    }


    /*
     * =========================
     * CONNECT BUTTON
     * =========================
     */

    connectBtn.addEventListener(
        "click",
        connectToServer
    );

   // ESCAPE KEY
    window.addEventListener("keydown", (e) => {

    if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA"
    ) {
        return;
    }

    if (e.key === "Escape") {

        if (pauseMenu.style.display === "flex") {
            pauseMenu.style.display = "none";
        } else {
            pauseMenu.style.display = "flex";
        }

    }

});

    /*
     * =========================
     * START
     * =========================
     */

    connectToServer();

