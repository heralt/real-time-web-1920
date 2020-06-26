const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fetch = require('node-fetch');
const levelup = require('levelup');
const leveldown = require('leveldown');

const db = levelup(leveldown('./songDb'));

app.set('view engine', 'ejs');
app.use(express.static('static'));

app.get('/', (req, res) => {
    res.render('index');
});

const PLAYLIST_ID = '71LMuR914gr93PYJweS7lO';

let queuedSongs = 0;

async function getSongFromDB(songID) {
    try {
        let text = await db.get(songID);
        let value = JSON.parse(text);
        return value;
    } catch (e) {
        return e;
    }
}

function putSongInDb(songID, song) {
    db.put(songID, song, function (err) {
        if (err) return console.log('Ooops!', err)
    });
}

function getSongFromSpotify(songData) {
    let url = `https://api.spotify.com/v1/tracks/${songData.songID}`;
    return fetch(url, {
        headers: {
            'Authorization': 'Bearer ' + songData.access
        }
    }).then(response => {
        return response.json();
    }).then(result => {
        return result;
    });
}

io.on('connection', (socket) => {

    let {username} = socket;
    username = "Anonymous";
    let roomName = 'room 1';
    socket.join(roomName);

    socket.on('pick room', (room) => {
        roomName = room.room;
        socket.join(roomName);
    });

    socket.on('other event', (data) => {
        console.log(data)
    });

    socket.on('connected', () => {
        socket.emit('playlistID', {
            playlistID: PLAYLIST_ID
        });
    });

    socket.on('click song', (data) => {
        let song = data.songID;
        getSongFromSpotify(data).then(result => {
            putSongInDb(song, JSON.stringify(result));
            io.sockets.to(roomName).emit('add song', {
                song: result,
                playlist: PLAYLIST_ID,
            });
        });
    });

    socket.on('click song que', (data) => {
        let song = data.songID;
        getSongFromDB(song).then(value => {
            if(value.notFound){
                console.log('from api');
                getSongFromSpotify(data).then(result => {
                    putSongInDb(song, JSON.stringify(result));
                    io.to(roomName).emit('queue song', {
                        song: result,
                        playlist: PLAYLIST_ID,
                    });
                });
            } else {
                console.log('from db');
                io.to(roomName).emit('queue song', {
                    song: value,
                    playlist: PLAYLIST_ID,
                });
            }
        });
    });

    socket.on('queued songs', () => {
        queuedSongs += 1;
        io.sockets.emit('queued songs', {
            queued: queuedSongs
        });
    });

    socket.on('queued played', () => {
        if (queuedSongs > 0) {
            queuedSongs -= 1;
        } else {
            queuedSongs = 0;
        }
        io.sockets.emit('queued songs', {
            queued: queuedSongs
        });
    });

    socket.on('song no active', (data) => {
        socket.in(roomName).emit('change state', {
            state: data.state
        })
    });

    socket.on('new_message', (data) => {
        io.in(roomName).emit('new_message', {message: data.message, username: username});
    });

    socket.on('change_username', (data) => {
        console.log(username);
        username = data.username;
    });

    socket.on('disconnect', () => {

    });
});

const server = http.listen(process.env.PORT || 3000);