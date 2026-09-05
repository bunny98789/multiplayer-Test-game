// ========================================
// FREE MULTIPLAYER GAME - SERVER
// ROOMS + USERNAMES + SPECTATING + COLORS
// ========================================

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer();

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const rooms = {};

const BULLET_SPEED = 10;
const BULLET_RADIUS = 5;
const BULLET_LIFETIME = 3000;

const PLAYER_RADIUS = 20;
const BULLET_DAMAGE = 25;

const MAX_AMMO = 6;
const RELOAD_TIME = 2000;


// ========================================
// COLORS
// ========================================

const COLORS = [
    "#FF3366",
    "#33FF66",
    "#3366FF",
    "#FFFF33",
    "#FF9933",
    "#CC33FF",
    "#33FFFF"
];


function getRandomColor() {

    return COLORS[
        Math.floor(
            Math.random() * COLORS.length
        )
    ];
}


// ========================================
// ROOM CODE
// ========================================

function createRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 8; i++) {

        code += characters[
            Math.floor(
                Math.random() * characters.length
            )
        ];

    }

    return code;
}


// ========================================
// SEND ROOM STATE
// ========================================

function sendGameState(roomCode) {

    const room = rooms[roomCode];

    if (!room) return;


    io.to(roomCode).emit(
        "updatePlayers",
        room.players
    );


    io.to(roomCode).emit(
        "updateBullets",
        room.bullets
    );

}


// ========================================
// CREATE PLAYER
// ========================================

function createPlayer(socket, username) {

    return {

        x:
            50 +
            Math.random() * 500,

        y:
            50 +
            Math.random() * 300,

        angle: 0,

        color:
            getRandomColor(),

        username:
            username,

        health: 100,

        ammo:
            MAX_AMMO,

        reloading: false,

        dead: false,

        spectating: false,

        round: 1

    };
}


// ========================================
// REMOVE PLAYER FROM ROOM
// ========================================

function removePlayerFromRoom(socket) {

    const roomCode =
        socket.roomCode;

    if (!roomCode) {
        return;
    }


    const room =
        rooms[roomCode];

    if (!room) {

        socket.roomCode = null;

        return;
    }


    const player =
        room.players[socket.id];


    if (!player) {

        socket.roomCode = null;

        return;
    }


    console.log(
        `${player.username} left room ${roomCode}`
    );


    // Remove player's bullets

    for (
        const bulletId in room.bullets
    ) {

        if (
            room.bullets[bulletId].owner ===
            socket.id
        ) {

            delete room.bullets[
                bulletId
            ];

        }

    }


    // Remove player

    delete room.players[
        socket.id
    ];


    // Leave Socket.IO room

    socket.leave(roomCode);


    socket.roomCode = null;


    // Delete empty room

    if (
        Object.keys(room.players).length === 0
    ) {

        delete rooms[roomCode];

        console.log(
            `Room ${roomCode} deleted`
        );

        return;
    }


    // Transfer host

    if (
        room.host === socket.id
    ) {

        room.host =
            Object.keys(
                room.players
            )[0];


        const newHost =
            room.players[
                room.host
            ];


        if (newHost) {

            console.log(
                `${newHost.username} is now host of ${roomCode}`
            );

        }

    }


    sendGameState(roomCode);

}


// ========================================
// RELOAD
// ========================================

function startReload(roomCode, playerId) {

    const room =
        rooms[roomCode];

    if (!room) return;


    const player =
        room.players[playerId];

    if (!player) return;


    if (player.dead) return;

    if (player.spectating) return;

    if (player.reloading) return;

    if (player.ammo >= MAX_AMMO) return;


    player.reloading = true;


    sendGameState(roomCode);


    setTimeout(() => {

        const currentRoom =
            rooms[roomCode];

        if (!currentRoom) return;


        const currentPlayer =
            currentRoom.players[playerId];

        if (!currentPlayer) return;


        if (
            currentPlayer.dead ||
            currentPlayer.spectating
        ) {

            currentPlayer.reloading =
                false;

            sendGameState(roomCode);

            return;
        }


        currentPlayer.ammo =
            MAX_AMMO;

        currentPlayer.reloading =
            false;


        sendGameState(roomCode);

    }, RELOAD_TIME);

}


// ========================================
// SOCKET CONNECTION
// ========================================

io.on("connection", (socket) => {

    console.log(
        `Player connected: ${socket.id}`
    );


    // ====================================
    // CREATE ROOM
    // ====================================

    socket.on("createRoom", (username) => {

        if (
            typeof username !== "string"
        ) {
            return;
        }


        username =
            username.trim();


        if (!username) {
            return;
        }


        username =
            username.substring(0, 16);


        let roomCode =
            createRoomCode();


        while (rooms[roomCode]) {

            roomCode =
                createRoomCode();

        }


        rooms[roomCode] = {

            players: {},

            bullets: {},

            nextBulletId: 1,

            host:
                socket.id,

            settings: {

                maxPlayers: 8,

                rounds: 5

            }

        };


        socket.join(roomCode);

        socket.roomCode =
            roomCode;

        socket.username =
            username;


        rooms[roomCode].players[
            socket.id
        ] =
            createPlayer(
                socket,
                username
            );


        console.log(
            `${username} created room ${roomCode}`
        );


        socket.emit(
            "roomJoined",
            {
                roomCode:
                    roomCode,

                username:
                    username
            }
        );


        sendGameState(roomCode);

    });


    // ====================================
    // JOIN ROOM
    // ====================================

    socket.on("joinRoom", (data) => {

        if (
            !data ||
            typeof data !== "object"
        ) {
            return;
        }


        let roomCode =
            data.roomCode;

        let username =
            data.username;


        if (
            typeof roomCode !== "string" ||
            typeof username !== "string"
        ) {
            return;
        }


        roomCode =
            roomCode
                .trim()
                .toUpperCase();

        username =
            username.trim();


        if (
            !roomCode ||
            !username
        ) {

            socket.emit(
                "roomError",
                "Enter a username and room code."
            );

            return;
        }


        username =
            username.substring(0, 16);


        const room =
            rooms[roomCode];


        if (!room) {

            socket.emit(
                "roomError",
                "That room does not exist."
            );

            return;
        }


        if (
            Object.keys(room.players).length >=
            room.settings.maxPlayers
        ) {

            socket.emit(
                "roomError",
                "That room is full."
            );

            return;
        }


        socket.join(roomCode);

        socket.roomCode =
            roomCode;

        socket.username =
            username;


        room.players[socket.id] =
            createPlayer(
                socket,
                username
            );


        console.log(
            `${username} joined room ${roomCode}`
        );


        socket.emit(
            "roomJoined",
            {
                roomCode:
                    roomCode,

                username:
                    username
            }
        );


        sendGameState(roomCode);

    });


    // ====================================
    // SPECTATE
    // ====================================

    socket.on("spectate", () => {

        const roomCode =
            socket.roomCode;

        const room =
            rooms[roomCode];

        if (!room) return;


        const player =
            room.players[socket.id];

        if (!player) return;


        player.spectating =
            !player.spectating;


        // Reset combat-related state
        // when entering spectate mode

        if (player.spectating) {

            player.reloading =
                false;

            console.log(
                `${player.username} is now spectating in ${roomCode}`
            );

        } else {

            console.log(
                `${player.username} returned to the game in ${roomCode}`
            );

        }


        sendGameState(roomCode);

    });


    // ====================================
    // CHANGE COLOR
    // ====================================

    socket.on("changeColor", () => {

        const roomCode =
            socket.roomCode;

        const room =
            rooms[roomCode];

        if (!room) return;


        const player =
            room.players[socket.id];

        if (!player) return;


        const currentIndex =
            COLORS.indexOf(
                player.color
            );


        const nextIndex =
            currentIndex === -1
                ? 0
                : (
                    currentIndex + 1
                ) % COLORS.length;


        player.color =
            COLORS[nextIndex];


        console.log(
            `${player.username} changed color to ${player.color}`
        );


        sendGameState(roomCode);

    });


    // ====================================
    // LEAVE ROOM
    // ====================================

    socket.on("leaveRoom", () => {

        removePlayerFromRoom(socket);

        socket.emit(
            "leftRoom"
        );

    });


    // ====================================
    // MOVE
    // ====================================

    socket.on("move", (data) => {

        const roomCode =
            socket.roomCode;

        const room =
            rooms[roomCode];

        if (!room) return;


        const player =
            room.players[socket.id];

        if (!player) return;


        if (player.dead) return;

        if (player.spectating) return;


        if (
            typeof data !== "object" ||
            data === null ||
            typeof data.x !== "number" ||
            typeof data.y !== "number" ||
            !Number.isFinite(data.x) ||
            !Number.isFinite(data.y)
        ) {
            return;
        }


        const moveX =
            Math.max(
                -20,
                Math.min(20, data.x)
            );

        const moveY =
            Math.max(
                -20,
                Math.min(20, data.y)
            );


        player.x =
            Math.max(
                20,
                Math.min(
                    580,
                    player.x + moveX
                )
            );


        player.y =
            Math.max(
                20,
                Math.min(
                    380,
                    player.y + moveY
                )
            );


        io.to(roomCode).emit(
            "updatePlayers",
            room.players
        );

    });


    // ====================================
    // AIM
    // ====================================

    socket.on("aim", (data) => {

        const roomCode =
            socket.roomCode;

        const room =
            rooms[roomCode];

        if (!room) return;


        const player =
            room.players[socket.id];

        if (!player) return;


        if (player.dead) return;

        if (player.spectating) return;


        if (
            !data ||
            typeof data.angle !== "number" ||
            !Number.isFinite(data.angle)
        ) {
            return;
        }


        player.angle =
            data.angle;


        io.to(roomCode).emit(
            "updatePlayers",
            room.players
        );

    });


    // ====================================
    // SHOOT
    // ====================================

    socket.on("shoot", () => {

        const roomCode =
            socket.roomCode;

        const room =
            rooms[roomCode];

        if (!room) return;


        const player =
            room.players[socket.id];

        if (!player) return;


        if (player.dead) return;

        if (player.spectating) return;

        if (player.reloading) return;

        if (player.ammo <= 0) return;


        player.ammo--;


        const bulletId =
            String(
                room.nextBulletId++
            );


        const angle =
            player.angle || 0;


        const startDistance =
            25;


        room.bullets[bulletId] = {

            id:
                bulletId,

            x:
                player.x +
                Math.cos(angle) *
                startDistance,

            y:
                player.y +
                Math.sin(angle) *
                startDistance,

            previousX:
                player.x +
                Math.cos(angle) *
                startDistance,

            previousY:
                player.y +
                Math.sin(angle) *
                startDistance,

            angle:
                angle,

            owner:
                socket.id,

            createdAt:
                Date.now()

        };


        console.log(
            `${player.username} fired bullet ${bulletId}`
        );


        if (player.ammo === 0) {

            startReload(
                roomCode,
                socket.id
            );

        }


        sendGameState(roomCode);

    });


    // ====================================
    // RELOAD
    // ====================================

    socket.on("reload", () => {

        const roomCode =
            socket.roomCode;

        const room =
            rooms[roomCode];

        if (!room) return;


        const player =
            room.players[socket.id];

        if (!player) return;

        if (player.spectating) return;


        startReload(
            roomCode,
            socket.id
        );

    });


    // ====================================
    // DISCONNECT
    // ====================================

    socket.on("disconnect", () => {

        console.log(
            `Player disconnected: ${socket.id}`
        );


        removePlayerFromRoom(socket);

    });

});


// ========================================
// BULLET LOOP
// ========================================

setInterval(() => {

    const now =
        Date.now();


    for (
        const roomCode in rooms
    ) {

        const room =
            rooms[roomCode];


        for (
            const bulletId in room.bullets
        ) {

            const bullet =
                room.bullets[bulletId];

            if (!bullet) continue;


            bullet.previousX =
                bullet.x;

            bullet.previousY =
                bullet.y;


            bullet.x +=
                Math.cos(bullet.angle) *
                BULLET_SPEED;

            bullet.y +=
                Math.sin(bullet.angle) *
                BULLET_SPEED;


            // ====================================
            // BULLET LIFETIME
            // ====================================

            if (
                now -
                bullet.createdAt >
                BULLET_LIFETIME
            ) {

                delete room.bullets[
                    bulletId
                ];

                continue;
            }


            // ====================================
            // OUT OF BOUNDS
            // ====================================

            if (
                bullet.x <
                    -BULLET_RADIUS ||

                bullet.x >
                    600 +
                    BULLET_RADIUS ||

                bullet.y <
                    -BULLET_RADIUS ||

                bullet.y >
                    400 +
                    BULLET_RADIUS
            ) {

                delete room.bullets[
                    bulletId
                ];

                continue;
            }


            // ====================================
            // PLAYER COLLISION
            // ====================================

            for (
                const playerId in room.players
            ) {

                const player =
                    room.players[playerId];


                if (!player) continue;


                // Don't hit bullet owner

                if (
                    playerId ===
                    bullet.owner
                ) {
                    continue;
                }


                // Dead players cannot be hit

                if (player.dead) continue;


                // Spectators cannot be hit

                if (player.spectating) continue;


                const dx =
                    bullet.x -
                    bullet.previousX;

                const dy =
                    bullet.y -
                    bullet.previousY;


                const lengthSquared =
                    dx * dx +
                    dy * dy;


                let t = 0;


                if (
                    lengthSquared > 0
                ) {

                    t =
                        (
                            (
                                player.x -
                                bullet.previousX
                            ) * dx +

                            (
                                player.y -
                                bullet.previousY
                            ) * dy
                        ) /
                        lengthSquared;


                    t =
                        Math.max(
                            0,
                            Math.min(
                                1,
                                t
                            )
                        );

                }


                const closestX =
                    bullet.previousX +
                    t * dx;

                const closestY =
                    bullet.previousY +
                    t * dy;


                const distanceX =
                    player.x -
                    closestX;

                const distanceY =
                    player.y -
                    closestY;


                const distance =
                    Math.sqrt(
                        distanceX *
                        distanceX +

                        distanceY *
                        distanceY
                    );


                if (
                    distance <=
                    PLAYER_RADIUS +
                    BULLET_RADIUS
                ) {

                    player.health -=
                        BULLET_DAMAGE;


                    console.log(
                        `${player.username} was hit!`,
                        player.health,
                        "HP remaining"
                    );


                    delete room.bullets[
                        bulletId
                    ];


                    if (
                        player.health <= 0
                    ) {

                        player.health = 0;

                        player.dead = true;

                        player.reloading =
                            false;


                        console.log(
                            `${player.username} DIED`
                        );


                        // Temporary respawn
                        // until round system is added

                        setTimeout(() => {

                            const currentRoom =
                                rooms[roomCode];

                            if (!currentRoom) {
                                return;
                            }


                            const respawnPlayer =
                                currentRoom.players[
                                    playerId
                                ];

                            if (
                                !respawnPlayer
                            ) {
                                return;
                            }


                            // Don't respawn a spectator

                            if (
                                respawnPlayer.spectating
                            ) {
                                return;
                            }


                            respawnPlayer.health =
                                100;

                            respawnPlayer.ammo =
                                MAX_AMMO;

                            respawnPlayer.reloading =
                                false;

                            respawnPlayer.dead =
                                false;


                            respawnPlayer.x =
                                50 +
                                Math.random() *
                                500;

                            respawnPlayer.y =
                                50 +
                                Math.random() *
                                300;


                            sendGameState(
                                roomCode
                            );

                        }, 2000);

                    }


                    break;

                }

            }

        }


        sendGameState(roomCode);

    }

}, 1000 / 60);


// ========================================
// SERVER
// ========================================

const PORT =
    process.env.PORT || 3000;


server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "--------------------------------"
        );

        console.log(
            "FREE MULTIPLAYER GAME SERVER"
        );

        console.log(
            "--------------------------------"
        );

        console.log(
            "Server running on port " + PORT
        );

        console.log(
            "Rooms + usernames + spectating enabled"
        );

        console.log(
            "--------------------------------"
        );

    }
);
